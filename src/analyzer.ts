import type { LanguageModel } from "ai";
import { generateText } from "ai";

import type { JSDocMode, Provider } from "./config.js";
import type { RouteInfo } from "./scanner.js";

import { computeHash, RouteCache } from "./cache.js";
import { createModel, getModelId } from "./providers/index.js";

export interface AnalyzeOptions {
  provider: Provider;
  jsdocMode: JSDocMode;
  cache: boolean;
  cacheDir: string;
}

export interface AnalyzedRoute {
  urlPath: string;
  pathItem: Record<string, unknown>;
  fromCache: boolean;
  skippedLLM: boolean;
}

export async function analyzeRoutes(
  routes: RouteInfo[],
  options: AnalyzeOptions,
): Promise<AnalyzedRoute[]> {
  const modelId = getModelId(options.provider);
  const cache = options.cache ? new RouteCache(options.cacheDir) : null;

  // Lazy-init the model only when we actually need it
  let model: LanguageModel | null = null;
  const getModel = (): LanguageModel => {
    if (!model) model = createModel(options.provider);
    return model;
  };

  const results: AnalyzedRoute[] = [];

  for (const route of routes) {
    const result = await analyzeRoute(route, options, modelId, cache, getModel);
    results.push(result);
  }

  return results;
}

async function analyzeRoute(
  route: RouteInfo,
  options: AnalyzeOptions,
  modelId: string,
  cache: RouteCache | null,
  getModel: () => LanguageModel,
): Promise<AnalyzedRoute> {
  // If @openapi-exact is present or jsdocMode is 'exact', skip LLM
  if (route.hasExactJsdoc && route.exactPathItem) {
    return {
      urlPath: route.urlPath,
      pathItem: route.exactPathItem,
      fromCache: false,
      skippedLLM: true,
    };
  }

  if (options.jsdocMode === "exact") {
    // In exact mode, if there's a @openapi tag, use it; otherwise still use LLM
    if (route.hasExactJsdoc && route.exactPathItem) {
      return {
        urlPath: route.urlPath,
        pathItem: route.exactPathItem,
        fromCache: false,
        skippedLLM: true,
      };
    }
  }

  // Compute cache hash
  const hash = computeHash(route.sourceCode, options.provider, modelId);

  // Check cache
  if (cache) {
    const cached = cache.get(hash);
    if (cached) {
      return {
        urlPath: route.urlPath,
        pathItem: cached,
        fromCache: true,
        skippedLLM: true,
      };
    }
  }

  // Call LLM
  let pathItem: Record<string, unknown>;
  try {
    pathItem = await callLLM(route, options.jsdocMode, getModel());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isContentFilter =
      message.includes("content filtering policy") ||
      message.includes("content_filter") ||
      (err as { status?: number })?.status === 400;

    if (isContentFilter) {
      console.warn(
        `Warning: Content filter blocked response for ${route.urlPath}. ` +
          `Skipping route. Use @openapi-exact JSDoc to provide the spec manually.`,
      );
      return {
        urlPath: route.urlPath,
        pathItem: {},
        fromCache: false,
        skippedLLM: false,
      };
    }
    throw err;
  }

  // Store in cache
  if (cache) {
    cache.set(hash, pathItem);
  }

  return {
    urlPath: route.urlPath,
    pathItem,
    fromCache: false,
    skippedLLM: false,
  };
}

function buildPrompt(route: RouteInfo, jsdocMode: JSDocMode): string {
  const jsDocSection =
    route.jsdocComments.length > 0
      ? `JSDoc COMMENTS (use as ${jsdocMode === "context" ? "additional context" : "primary source"}):\n${route.jsdocComments.join("\n\n")}`
      : "No JSDoc comments found.";

  return `You are a technical documentation tool that reads existing source code and produces OpenAPI 3.1 documentation data. You do not write or execute code — you only read and describe it.

## Task

Read the Next.js API route source file below and produce a JSON object that documents its HTTP endpoints according to the OpenAPI 3.1 PathItem schema.

## Route metadata

- File: ${route.relativePath}
- URL path: ${route.urlPath}

## Source file contents

\`\`\`typescript
${route.sourceCode}
\`\`\`

${jsDocSection}

## Instructions

For each exported function named GET, POST, PUT, PATCH, or DELETE, document:
- operationId: a unique camelCase identifier
- summary: a short one-line description
- description: a fuller explanation of what the endpoint does
- parameters: path params from URL segments like {id}, and query params from searchParams usage
- requestBody: schema inferred from request.json() calls and TypeScript types (POST/PUT/PATCH only)
- responses: per status code, inferred from NextResponse.json() calls and return type annotations
- tags: inferred from the URL path segments
- security: noted if the code checks for auth tokens, session cookies, or middleware guards

## Output format

Return a single raw JSON object matching the OpenAPI 3.1 PathItem schema. No explanation, no markdown fences, no extra text — only the JSON object.`;
}

async function callLLM(
  route: RouteInfo,
  jsdocMode: JSDocMode,
  model: LanguageModel,
): Promise<Record<string, unknown>> {
  const prompt = buildPrompt(route, jsdocMode);

  const { text } = await generateText({
    model,
    prompt,
    temperature: 0,
  });

  return parsePathItem(text, route.urlPath);
}

function parsePathItem(text: string, urlPath: string): Record<string, unknown> {
  // Strip any accidental markdown code fences
  let json = text.trim();
  if (json.startsWith("```")) {
    json = json
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  try {
    const parsed = JSON.parse(json);
    if (
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      parsed === null
    ) {
      throw new Error("Response is not a JSON object");
    }
    return parsed;
  } catch (err) {
    console.warn(
      `Warning: Failed to parse LLM response for ${urlPath}. Using empty PathItem.`,
      err,
    );
    return {};
  }
}
