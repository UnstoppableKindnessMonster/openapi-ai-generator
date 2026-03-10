# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

---

## [0.1.0] — 2026-03-10

### Added

- Initial release
- **Route scanning** — glob `src/app/api/**/route.ts` files in Next.js App Router projects
- **LLM analysis** — send route source + JSDoc to an LLM and extract an OpenAPI 3.1 `PathItem`
- **Three providers** via Vercel AI SDK:
  - Azure OpenAI (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`)
  - OpenAI (`OPENAI_API_KEY`, `OPENAI_MODEL`)
  - Anthropic (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`)
- **SHA-256 content-hash cache** — skip LLM for unchanged routes; cache invalidated when file content or provider/model changes
- **JSDoc integration** — `jsdocMode: 'context'` passes JSDoc as LLM context; `@openapi-exact` per-route tag uses JSDoc JSON verbatim, skipping LLM entirely
- **Output generation** — writes `spec.json` + static Next.js `route.ts` serving `GET /api/openapi.json`
- **Scalar docs** — optional `scalarDocs: true` generates a Scalar interactive UI route at `/api/docs`
- **CLI** — `npx openapi-ai-generator generate` with `--config`, `--provider`, `--no-cache` flags
- **Next.js plugin** — `withOpenAPIGen()` wraps `next.config.ts` and runs generation before each build
- **Programmatic API** — `generate()`, `loadConfig()`, `scanRoutes()`, `analyzeRoutes()`, `assembleSpec()`, `writeOutputFiles()`
- **Path conversion** — Next.js `[param]`, `[...param]`, `[[...param]]` segments → OpenAPI `{param}`
- TypeScript-first; ships CJS + ESM builds with full `.d.ts` declarations

[Unreleased]: https://github.com/your-org/openapi-ai-generator/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-org/openapi-ai-generator/releases/tag/v0.1.0
