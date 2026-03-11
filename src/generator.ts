import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";

import type { AnalyzedRoute } from "./analyzer.js";
import type { ResolvedConfig } from "./config.js";

export interface OpenAPISpec {
  openapi: "3.1.0";
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  security?: Array<{ [key: string]: string[] }>;
  components?: {
    securitySchemes?: Record<string, unknown>;
    [key: string]: unknown;
  };
  paths: Record<string, unknown>;
}

export function assembleSpec(
  config: ResolvedConfig,
  routes: AnalyzedRoute[],
): OpenAPISpec {
  const paths: Record<string, unknown> = {};

  for (const route of routes) {
    if (Object.keys(route.pathItem).length > 0) {
      paths[route.urlPath] = route.pathItem;
    }
  }

  const spec: OpenAPISpec = {
    openapi: "3.1.0",
    info: {
      title: config.openapi.title,
      version: config.openapi.version,
      ...(config.openapi.description
        ? { description: config.openapi.description }
        : {}),
    },
    paths,
  };

  if (config.openapi.servers && config.openapi.servers.length > 0) {
    spec.servers = config.openapi.servers;
  }

  if (config.openapi.security && config.openapi.security.length > 0) {
    spec.security = config.openapi.security;
  }

  if (
    config.openapi.components &&
    Object.keys(config.openapi.components).length > 0
  ) {
    spec.components = config.openapi.components;
  }

  return spec;
}

export function writeOutputFiles(
  config: ResolvedConfig,
  spec: OpenAPISpec,
  cwd: string = process.cwd(),
): void {
  writeSpecFiles(config, spec, cwd);

  if (config.output.scalarDocs) {
    writeScalarRoute(config, cwd);
  }
}

function writeSpecFiles(
  config: ResolvedConfig,
  spec: OpenAPISpec,
  cwd: string,
): void {
  const specRoutePath = resolve(cwd, config.output.specPath);
  const specDir = dirname(specRoutePath);

  ensureDir(specDir);

  // Write spec.json co-located with the route
  const specJsonPath = join(specDir, "spec.json");
  writeFileSync(specJsonPath, JSON.stringify(spec, null, 2), "utf8");

  // Write the Next.js route that serves the spec
  const routeContent = `import spec from './spec.json';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(spec);
}
`;
  writeFileSync(specRoutePath, routeContent, "utf8");
}

function writeScalarRoute(config: ResolvedConfig, cwd: string): void {
  const scalarRoutePath = resolve(cwd, config.output.scalarPath);
  ensureDir(dirname(scalarRoutePath));

  // Derive the spec URL from the specPath
  const specUrl = filePathToApiUrl(config.output.specPath);

  const routeContent = `export const dynamic = 'force-static';

export function GET() {
  return new Response(
    \`<!doctype html>
<html>
  <head>
    <title>API Docs</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script
      id="api-reference"
      data-url="${specUrl}"
      ${config.output.scalarConfig && Object.keys(config.output.scalarConfig).length > 0 ? `data-config="${JSON.stringify(config.output.scalarConfig)}"` : ""}
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>\`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}
`;
  writeFileSync(scalarRoutePath, routeContent, "utf8");
}

/**
 * Convert a file path like src/app/api/openapi.json/route.ts to /api/openapi.json
 */
function filePathToApiUrl(filePath: string): string {
  let path = filePath.replace(/\\/g, "/");
  path = path.replace(/^(src\/)?app\//, "");
  path = path.replace(/\/route\.(ts|tsx|js|jsx)$/, "");
  if (!path.startsWith("/")) path = `/${path}`;
  return path;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}
