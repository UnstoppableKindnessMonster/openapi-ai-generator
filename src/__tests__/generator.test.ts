import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { AnalyzedRoute } from "../analyzer.js";
import type { ResolvedConfig } from "../config.js";

import { assembleSpec, writeOutputFiles } from "../generator.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ResolvedConfig> = {}): ResolvedConfig {
  return {
    envFile: false,
    provider: "openai",
    jsdocMode: "context",
    cache: true,
    cacheDir: ".openapi-cache",
    include: ["src/app/api/**/route.ts"],
    exclude: [],
    output: {
      specPath: "src/app/api/openapi.json/route.ts",
      scalarDocs: false,
      scalarPath: "src/app/api/docs/route.ts",
    },
    openapi: {
      title: "Test API",
      version: "1.0.0",
      description: "",
      servers: [],
      security: [],
      components: {},
    },
    limits: {
      maxTokens: 4000,
      timeoutMs: 60_000,
    },
    ...overrides,
  };
}

function makeRoute(
  urlPath: string,
  pathItem: Record<string, unknown> = {},
): AnalyzedRoute {
  return { urlPath, pathItem, fromCache: false, skippedLLM: false };
}

// ---------------------------------------------------------------------------
// assembleSpec
// ---------------------------------------------------------------------------

describe("assembleSpec", () => {
  it("sets openapi version to 3.1.0", () => {
    const spec = assembleSpec(makeConfig(), []);
    expect(spec.openapi).toBe("3.1.0");
  });

  it("populates info from config", () => {
    const spec = assembleSpec(makeConfig(), []);
    expect(spec.info.title).toBe("Test API");
    expect(spec.info.version).toBe("1.0.0");
  });

  it("includes description when provided", () => {
    const spec = assembleSpec(
      makeConfig({
        openapi: {
          title: "T",
          version: "1",
          description: "My API",
          servers: [],
          security: [],
          components: {},
        },
      }),
      [],
    );
    expect(spec.info.description).toBe("My API");
  });

  it("omits description when empty", () => {
    const spec = assembleSpec(makeConfig(), []);
    expect(spec.info.description).toBeUndefined();
  });

  it("includes servers when provided", () => {
    const servers = [{ url: "https://api.example.com", description: "Prod" }];
    const spec = assembleSpec(
      makeConfig({
        openapi: {
          title: "T",
          version: "1",
          description: "",
          servers,
          security: [],
          components: {},
        },
      }),
      [],
    );
    expect(spec.servers).toEqual(servers);
  });

  it("omits servers when empty", () => {
    const spec = assembleSpec(makeConfig(), []);
    expect(spec.servers).toBeUndefined();
  });

  it("maps analyzed routes to paths", () => {
    const routes = [
      makeRoute("/api/users", { get: { operationId: "listUsers" } }),
      makeRoute("/api/posts", { get: { operationId: "listPosts" } }),
    ];
    const spec = assembleSpec(makeConfig(), routes);
    expect(spec.paths["/api/users"]).toEqual({
      get: { operationId: "listUsers" },
    });
    expect(spec.paths["/api/posts"]).toEqual({
      get: { operationId: "listPosts" },
    });
  });

  it("skips routes with empty PathItems", () => {
    const routes = [
      makeRoute("/api/empty", {}),
      makeRoute("/api/users", { get: { operationId: "listUsers" } }),
    ];
    const spec = assembleSpec(makeConfig(), routes);
    expect(spec.paths["/api/empty"]).toBeUndefined();
    expect(spec.paths["/api/users"]).toBeDefined();
  });

  it("returns an empty paths object when no routes are provided", () => {
    const spec = assembleSpec(makeConfig(), []);
    expect(spec.paths).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// writeOutputFiles
// ---------------------------------------------------------------------------

describe("writeOutputFiles", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "openapi-gen-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes spec.json to the correct directory", () => {
    const config = makeConfig({
      output: {
        specPath: "src/app/api/openapi.json/route.ts",
        scalarDocs: false,
        scalarPath: "src/app/api/docs/route.ts",
      },
    });
    const spec = assembleSpec(config, [makeRoute("/api/users", { get: {} })]);
    writeOutputFiles(config, spec, tmpDir);

    const specJsonPath = join(tmpDir, "src/app/api/openapi.json/spec.json");
    expect(existsSync(specJsonPath)).toBe(true);

    const written = JSON.parse(readFileSync(specJsonPath, "utf8"));
    expect(written.openapi).toBe("3.1.0");
    expect(written.info.title).toBe("Test API");
  });

  it("writes a valid Next.js GET route.ts", () => {
    const config = makeConfig({
      output: {
        specPath: "src/app/api/openapi.json/route.ts",
        scalarDocs: false,
        scalarPath: "src/app/api/docs/route.ts",
      },
    });
    const spec = assembleSpec(config, []);
    writeOutputFiles(config, spec, tmpDir);

    const routePath = join(tmpDir, "src/app/api/openapi.json/route.ts");
    const content = readFileSync(routePath, "utf8");
    expect(content).toContain("import spec from './spec.json'");
    expect(content).toContain("export const dynamic = 'force-static'");
    expect(content).toContain("export function GET()");
    expect(content).toContain("return Response.json(spec)");
  });

  it("does not write scalar route when scalarDocs is false", () => {
    const config = makeConfig({
      output: {
        specPath: "src/app/api/openapi.json/route.ts",
        scalarDocs: false,
        scalarPath: "src/app/api/docs/route.ts",
      },
    });
    writeOutputFiles(config, assembleSpec(config, []), tmpDir);

    const scalarPath = join(tmpDir, "src/app/api/docs/route.ts");
    expect(existsSync(scalarPath)).toBe(false);
  });

  it("writes scalar route when scalarDocs is true", () => {
    const config = makeConfig({
      output: {
        specPath: "src/app/api/openapi.json/route.ts",
        scalarDocs: true,
        scalarPath: "src/app/api/docs/route.ts",
      },
    });
    writeOutputFiles(config, assembleSpec(config, []), tmpDir);

    const scalarPath = join(tmpDir, "src/app/api/docs/route.ts");
    expect(existsSync(scalarPath)).toBe(true);

    const content = readFileSync(scalarPath, "utf8");
    expect(content).toContain("text/html");
    expect(content).toContain("@scalar/api-reference");
    expect(content).toContain("/api/openapi.json");
    expect(content).toContain("export const dynamic = 'force-static'");
  });

  it("creates nested output directories that do not exist", () => {
    const config = makeConfig({
      output: {
        specPath: "deep/nested/path/route.ts",
        scalarDocs: false,
        scalarPath: "src/app/api/docs/route.ts",
      },
    });
    writeOutputFiles(config, assembleSpec(config, []), tmpDir);
    expect(existsSync(join(tmpDir, "deep/nested/path/route.ts"))).toBe(true);
  });
});
