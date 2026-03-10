# openapi-ai-generator

Automatically generate an up-to-date **OpenAPI 3.1 spec** for your Next.js App Router API routes using an LLM. Runs at build time — no manual spec maintenance required.

[![npm version](https://img.shields.io/npm/v/openapi-ai-generator)](https://www.npmjs.com/package/openapi-ai-generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)

---

## How It Works

1. **Scans** your project for Next.js `route.ts` files matching your `include` glob patterns
2. **Analyzes** each route by sending its source code and JSDoc to your chosen LLM provider
3. **Caches** results by SHA-256 hash — unchanged routes are never re-analyzed
4. **Generates** a valid OpenAPI 3.1 `spec.json` and a Next.js `route.ts` that serves it at `/api/openapi.json`
5. Optionally generates a [Scalar](https://scalar.com) interactive docs UI at `/api/docs`

```
your routes ──► LLM analysis ──► OpenAPI 3.1 spec ──► /api/openapi.json
                     ▲
              SHA-256 cache
           (skip unchanged files)
```

---

## Table of Contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Providers](#providers)
- [CLI Usage](#cli-usage)
- [Next.js Plugin](#nextjs-plugin)
- [Programmatic API](#programmatic-api)
- [JSDoc Integration](#jsdoc-integration)
- [Caching](#caching)
- [Output Files](#output-files)
- [Scalar Docs UI](#scalar-docs-ui)
- [Path Conversion](#path-conversion)
- [Contributing](#contributing)
- [License](#license)

---

## Requirements

- Node.js 18+
- Next.js 13+ (App Router)
- An API key for one of: Azure OpenAI, OpenAI, or Anthropic

---

## Installation

```bash
npm install --save-dev openapi-ai-generator
# or
pnpm add -D openapi-ai-generator
# or
yarn add -D openapi-ai-generator
```

---

## Quick Start

### 1. Create a config file

```typescript
// openapi-gen.config.ts
import type { OpenAPIGenConfig } from 'openapi-ai-generator';

export default {
  provider: 'openai',
  output: {
    specPath: 'src/app/api/openapi.json/route.ts',
  },
  openapi: {
    title: 'My API',
    version: '1.0.0',
  },
} satisfies OpenAPIGenConfig;
```

### 2. Set your API key

```bash
export OPENAI_API_KEY=sk-...
```

### 3. Run the generator

```bash
npx openapi-ai-generator generate
```

### 4. Start your Next.js app and visit `/api/openapi.json`

Your live OpenAPI spec will be served automatically.

---

## Configuration

Create `openapi-gen.config.ts` (or `.js`, `.mjs`, `.cjs`) at your project root.

```typescript
import type { OpenAPIGenConfig } from 'openapi-ai-generator';

export default {
  // Required: which LLM provider to use
  provider: 'azure', // 'azure' | 'openai' | 'anthropic'

  // Output file paths (relative to project root)
  output: {
    specPath: 'src/app/api/openapi.json/route.ts', // serves GET /api/openapi.json
    scalarDocs: false,                              // true = also generate Scalar UI
    scalarPath: 'src/app/api/docs/route.ts',        // serves GET /api/docs
  },

  // OpenAPI info object
  openapi: {
    title: 'My API',
    version: '1.0.0',
    description: 'Auto-generated API documentation',
    servers: [
      { url: 'https://api.example.com', description: 'Production' },
      { url: 'http://localhost:3000',   description: 'Development' },
    ],
  },

  // How JSDoc comments are used during analysis
  jsdocMode: 'context', // 'context' | 'exact' — see JSDoc Integration below

  // SHA-256 content-based caching
  cache: true,
  cacheDir: '.openapi-cache',

  // Which route files to include/exclude
  include: ['src/app/api/**/route.ts'],
  exclude: [
    'src/app/api/openapi.json/route.ts',
    'src/app/api/docs/route.ts',
  ],
} satisfies OpenAPIGenConfig;
```

### Config Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `'azure' \| 'openai' \| 'anthropic'` | — | **Required.** LLM provider to use |
| `output.specPath` | `string` | — | **Required.** Path to the generated spec route file |
| `output.scalarDocs` | `boolean` | `false` | Generate Scalar interactive docs UI |
| `output.scalarPath` | `string` | `'src/app/api/docs/route.ts'` | Path for the Scalar docs route |
| `openapi.title` | `string` | — | **Required.** API title in the spec |
| `openapi.version` | `string` | — | **Required.** API version in the spec |
| `openapi.description` | `string` | `''` | API description |
| `openapi.servers` | `array` | `[]` | Server objects for the spec |
| `jsdocMode` | `'context' \| 'exact'` | `'context'` | How to use JSDoc (see below) |
| `cache` | `boolean` | `true` | Enable/disable content-hash caching |
| `cacheDir` | `string` | `'.openapi-cache'` | Directory for cache files |
| `include` | `string[]` | `['src/app/api/**/route.ts']` | Glob patterns for routes to analyze |
| `exclude` | `string[]` | `[]` | Glob patterns for routes to skip |

---

## Providers

### OpenAI

```bash
export OPENAI_API_KEY=sk-...
export OPENAI_MODEL=gpt-4o   # optional, default: gpt-4o
```

```typescript
// openapi-gen.config.ts
export default { provider: 'openai', ... } satisfies OpenAPIGenConfig;
```

### Anthropic

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export ANTHROPIC_MODEL=claude-sonnet-4-6   # optional, default: claude-sonnet-4-6
```

```typescript
export default { provider: 'anthropic', ... } satisfies OpenAPIGenConfig;
```

### Azure OpenAI

```bash
export AZURE_OPENAI_ENDPOINT=https://my-resource.openai.azure.com
export AZURE_OPENAI_API_KEY=...
export AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

```typescript
export default { provider: 'azure', ... } satisfies OpenAPIGenConfig;
```

### Environment Variable Reference

| Variable | Provider | Required | Default |
|----------|----------|----------|---------|
| `OPENAI_API_KEY` | openai | Yes | — |
| `OPENAI_MODEL` | openai | No | `gpt-4o` |
| `ANTHROPIC_API_KEY` | anthropic | Yes | — |
| `ANTHROPIC_MODEL` | anthropic | No | `claude-sonnet-4-6` |
| `AZURE_OPENAI_ENDPOINT` | azure | Yes | — |
| `AZURE_OPENAI_API_KEY` | azure | Yes | — |
| `AZURE_OPENAI_DEPLOYMENT` | azure | Yes | — |

---

## CLI Usage

```bash
# Basic — reads openapi-gen.config.ts from project root
npx openapi-ai-generator generate

# Custom config path
npx openapi-ai-generator generate --config ./config/openapi-gen.config.ts

# Override provider without editing config
npx openapi-ai-generator generate --provider anthropic

# Bypass cache — force re-analyze every route
npx openapi-ai-generator generate --no-cache
```

### CLI Options

| Flag | Short | Description |
|------|-------|-------------|
| `--config <path>` | `-c` | Path to config file |
| `--provider <name>` | `-p` | Override provider (`azure`, `openai`, `anthropic`) |
| `--no-cache` | | Force re-analysis of all routes, ignoring cache |
| `--version` | | Print version |
| `--help` | `-h` | Show help |

### Example Output

```
[openapi-ai-generator] Scanning routes...
[openapi-ai-generator] Found 8 route(s)
[openapi-ai-generator] Analyzing routes with provider: openai
[openapi-ai-generator] 8 routes analyzed (6 from cache, 0 exact JSDoc)

✓ OpenAPI spec generated successfully
  Routes analyzed:    8
  From cache:         6
  LLM calls made:     2
  Spec written to:    src/app/api/openapi.json/route.ts
```

---

## Next.js Plugin

The plugin automatically runs the generator before every `next build`, keeping your spec always in sync without a separate CI step.

```typescript
// next.config.ts
import type { NextConfig } from 'next';
import { withOpenAPIGen } from 'openapi-ai-generator/plugin';

const nextConfig: NextConfig = {
  // ... your existing Next.js config
};

export default withOpenAPIGen(nextConfig);
```

You can pass generator options as a second argument to override config file settings:

```typescript
export default withOpenAPIGen(nextConfig, {
  provider: 'openai',
  cache: true,
});
```

> **Note:** The plugin hooks into webpack's `beforeRun` event. It runs once per build, not per compilation chunk.

---

## Programmatic API

```typescript
import { generate, loadConfig, scanRoutes, analyzeRoutes, assembleSpec } from 'openapi-ai-generator';

// High-level: run the full pipeline
const result = await generate({
  config: './openapi-gen.config.ts', // optional config path
  provider: 'openai',                // optional override
  cache: true,                       // optional override
  cwd: process.cwd(),                // optional working directory
});

console.log(result.routesAnalyzed);   // number of routes processed
console.log(result.routesFromCache);  // routes served from cache
console.log(result.routesSkippedLLM); // routes that skipped LLM (cache + exact JSDoc)
console.log(result.specPath);         // output file path

// Low-level: use individual pipeline stages
const config = await loadConfig('./openapi-gen.config.ts');
const routes = await scanRoutes(config.include, config.exclude);
const analyzed = await analyzeRoutes(routes, {
  provider: config.provider,
  jsdocMode: config.jsdocMode,
  cache: config.cache,
  cacheDir: config.cacheDir,
});
const spec = assembleSpec(config, analyzed);
```

### Exported Types

```typescript
import type {
  OpenAPIGenConfig,   // raw config shape (for your config file)
  ResolvedConfig,     // fully resolved config with all defaults applied
  Provider,           // 'azure' | 'openai' | 'anthropic'
  JSDocMode,          // 'context' | 'exact'
  GenerateOptions,    // options for generate()
  GenerateResult,     // return value of generate()
} from 'openapi-ai-generator';
```

---

## JSDoc Integration

JSDoc comments in your route files are automatically extracted and passed to the LLM as context. You can also use them to skip the LLM entirely.

### `jsdocMode: 'context'` (default)

JSDoc comments are included in the LLM prompt as supplementary context. The LLM uses them alongside the source code to produce better descriptions, parameter docs, and response schemas.

```typescript
/**
 * Returns a paginated list of users.
 * Supports filtering by role and status.
 *
 * @param role - Filter users by role: 'admin' | 'user'
 * @param status - Filter by account status: 'active' | 'suspended'
 */
export async function GET(request: NextRequest) {
  // ...
}
```

### `jsdocMode: 'exact'` (config-level)

When set globally, all routes with a valid `@openapi` JSON tag will use it verbatim — no LLM call is made for those routes.

### `@openapi-exact` (per-route override)

Add `@openapi-exact` to a specific JSDoc block to skip LLM analysis for that route only, regardless of the global `jsdocMode`. The `@openapi` tag value must be a valid OpenAPI 3.1 `PathItem` JSON object.

```typescript
/**
 * @openapi-exact
 * @openapi {
 *   "get": {
 *     "operationId": "getUsers",
 *     "summary": "List users",
 *     "tags": ["Users"],
 *     "parameters": [
 *       {
 *         "name": "page",
 *         "in": "query",
 *         "schema": { "type": "integer", "default": 1 }
 *       }
 *     ],
 *     "responses": {
 *       "200": {
 *         "description": "Successful response",
 *         "content": {
 *           "application/json": {
 *             "schema": {
 *               "type": "array",
 *               "items": { "$ref": "#/components/schemas/User" }
 *             }
 *           }
 *         }
 *       }
 *     }
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  // ...
}
```

> If the `@openapi` JSON fails to parse, the route falls back to LLM analysis automatically.

---

## Caching

The cache stores LLM responses in `{cacheDir}/{hash}.json`. The hash is computed from:

```
SHA-256(fileContent + providerName + modelId)
```

This means the cache is automatically invalidated when:
- The route file's source code changes
- You switch to a different provider
- You switch to a different model

### Cache location

By default: `.openapi-cache/` in your project root.

Add it to `.gitignore` (see below) or commit it to speed up CI builds.

### Clearing the cache

```bash
rm -rf .openapi-cache
```

Or run with `--no-cache` to bypass it for a single run without deleting files.

---

## Output Files

### `spec.json` + `route.ts`

The generator creates two co-located files at the directory specified by `output.specPath`:

**`spec.json`** — the full OpenAPI 3.1 spec:
```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "My API",
    "version": "1.0.0"
  },
  "paths": {
    "/api/users": { ... },
    "/api/users/{id}": { ... }
  }
}
```

**`route.ts`** — a static Next.js route that serves it:
```typescript
import spec from './spec.json';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(spec);
}
```

Both files are **generated artifacts** — do not edit them manually. Add them to `.gitignore` or commit them, depending on your workflow.

---

## Scalar Docs UI

Set `output.scalarDocs: true` to also generate an interactive API docs page powered by [Scalar](https://scalar.com).

```typescript
// openapi-gen.config.ts
export default {
  output: {
    specPath:    'src/app/api/openapi.json/route.ts',
    scalarDocs:  true,
    scalarPath:  'src/app/api/docs/route.ts', // serves GET /api/docs
  },
  ...
} satisfies OpenAPIGenConfig;
```

Once generated, visit `/api/docs` in your running Next.js app to see the full interactive documentation.

---

## Path Conversion

Next.js file system routing is automatically converted to OpenAPI path syntax:

| File path | OpenAPI path |
|-----------|-------------|
| `src/app/api/users/route.ts` | `/api/users` |
| `src/app/api/users/[id]/route.ts` | `/api/users/{id}` |
| `src/app/api/posts/[postId]/comments/[commentId]/route.ts` | `/api/posts/{postId}/comments/{commentId}` |
| `src/app/api/files/[...path]/route.ts` | `/api/files/{path}` |
| `app/api/health/route.ts` | `/api/health` |

---

## Recommended `.gitignore` Additions

```gitignore
# openapi-ai-generator cache (or remove this line to commit cache for faster CI)
.openapi-cache/

# Generated spec files (optional — depends on your workflow)
# src/app/api/openapi.json/
# src/app/api/docs/
```

---

## Recommended `package.json` Scripts

```json
{
  "scripts": {
    "generate:openapi": "openapi-ai-generator generate",
    "build": "openapi-ai-generator generate && next build"
  }
}
```

---

## Troubleshooting

### "No openapi-gen.config.ts found"

Ensure your config file is at the project root (where you run the CLI) and is named `openapi-gen.config.ts`, `.js`, `.mjs`, or `.cjs`.

### "Cannot load TypeScript config file"

The CLI tries to load `.ts` config files using `tsx` or `ts-node`. Install one:

```bash
npm install --save-dev tsx
```

### LLM returns invalid JSON

The generator logs a warning and skips the route (producing an empty PathItem). Try:
- Using `@openapi-exact` with hand-written JSON for that route
- Running with `--no-cache` and retrying
- Switching to a more capable model

### Routes appear in spec but have no operations

The LLM likely couldn't infer enough from the source. Add JSDoc comments to the route to give it more context.

### Cache not working as expected

The cache is keyed on `fileContent + provider + modelId`. If you change env vars (e.g. `OPENAI_MODEL`), the cache is automatically invalidated. If you suspect corruption, delete `.openapi-cache/` and rerun.

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## Security

Please review our [Security Policy](./SECURITY.md) before reporting vulnerabilities.

---

## License

MIT — see [LICENSE](./LICENSE).
