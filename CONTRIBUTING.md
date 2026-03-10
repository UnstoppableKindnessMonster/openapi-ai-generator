# Contributing to openapi-ai-generator

Thank you for your interest in contributing! This document covers everything you need to get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Code of Conduct

This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- An API key for at least one supported provider (for integration testing)

### Fork and clone

```bash
git clone https://github.com/your-org/openapi-ai-generator.git
cd openapi-ai-generator
npm install
```

### Build

```bash
npm run build
```

### Type check

```bash
npm run typecheck
```

### Watch mode (during development)

```bash
npm run dev
```

---

## Development Workflow

The source lives entirely in `src/`. TypeScript is compiled to `dist/` via `tsup`. Never edit files in `dist/` — they are regenerated on every build.

### Key files to understand

| File | Responsibility |
|------|---------------|
| `src/config.ts` | Config type definitions and loader |
| `src/scanner.ts` | Glob route files, path conversion, JSDoc extraction |
| `src/analyzer.ts` | LLM prompt construction and response parsing |
| `src/generator.ts` | Assemble spec, write output files |
| `src/cache.ts` | SHA-256 content-hash cache |
| `src/providers/index.ts` | Provider factory (Azure / OpenAI / Anthropic) |
| `src/cli.ts` | CLI entry point (commander) |
| `src/plugin.ts` | Next.js webpack plugin |
| `src/index.ts` | Public programmatic API |

---

## Making Changes

1. Create a branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   # or
   git checkout -b fix/my-bug
   ```

2. Make your changes in `src/`.

3. Build and verify:
   ```bash
   npm run build
   npm run typecheck
   ```

4. Test your change manually using the example config:
   ```bash
   # In a Next.js project with the package linked
   npm link /path/to/openapi-ai-generator
   npx openapi-ai-generator generate
   ```

5. Commit (see commit message guidelines below).

6. Open a pull request.

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]

[optional footer]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `refactor` | Code change with no feature/fix |
| `perf` | Performance improvement |
| `test` | Adding or fixing tests |
| `chore` | Build, deps, tooling |
| `ci` | CI/CD changes |

### Examples

```
feat(analyzer): add retry logic for LLM rate limit errors
fix(scanner): handle Windows path separators in filePathToUrlPath
docs: add Anthropic provider example to README
chore(deps): update @ai-sdk/openai to 3.0.45
```

---

## Pull Requests

- **Keep PRs focused** — one feature or fix per PR. Large PRs are harder to review.
- **Fill out the PR template** — it helps reviewers understand your change quickly.
- **Reference issues** — use `Closes #123` or `Fixes #123` in the PR description.
- **Keep the `CHANGELOG.md` updated** — add a line under `[Unreleased]` describing your change.
- **Do not commit generated files** — `dist/` is excluded from PRs.

### PR checklist

- [ ] `npm run build` passes
- [ ] `npm run typecheck` passes
- [ ] Manual testing confirms the change works as intended
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] Documentation (README, JSDoc) updated if the public API changed

---

## Reporting Bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) when opening an issue. Please include:

- Node.js version (`node --version`)
- Package version
- Provider and model being used
- Minimal reproduction (a route file that demonstrates the problem)
- Full error output

---

## Requesting Features

Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md). Before opening, search existing issues to avoid duplicates.

---

## Adding a New Provider

1. Create `src/providers/your-provider.ts` — follow the pattern in `src/providers/index.ts`
2. Add the provider key to the `Provider` union type in `src/config.ts`
3. Add a case to the `createModel()` and `getModelId()` switches in `src/providers/index.ts`
4. Document the required environment variables in the README provider table
5. Add an entry to the CHANGELOG

---

## Questions?

Open a [Discussion](https://github.com/your-org/openapi-ai-generator/discussions) for questions that aren't bugs or feature requests.
