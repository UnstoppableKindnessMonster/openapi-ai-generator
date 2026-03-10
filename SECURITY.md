# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

**Please do not file a public GitHub issue for security vulnerabilities.**

Instead, email **security@example.com** with:

1. A description of the vulnerability and its potential impact
2. Steps to reproduce the issue
3. Any relevant code, logs, or screenshots
4. Your suggested fix (if you have one)

You will receive an acknowledgement within **48 hours** and a status update within **7 days**.

We will coordinate a disclosure timeline with you and credit you in the release notes (unless you prefer to remain anonymous).

## Scope

Items in scope:

- Arbitrary code execution via crafted config files or route files
- Path traversal in cache or output file paths
- Secret leakage (API keys logged or written to disk in unintended locations)
- Dependency vulnerabilities introduced by this package

Items out of scope:

- Vulnerabilities in the underlying LLM provider APIs (report those to the respective providers)
- Issues that require physical access to the developer machine
- Social engineering attacks

## Security Considerations for Users

- **API keys**: Store provider API keys in environment variables or a secrets manager. Never commit them to source control.
- **Cache directory**: The `.openapi-cache/` directory contains LLM responses derived from your source code. Treat it as potentially sensitive and add it to `.gitignore` if your routes contain proprietary logic.
- **Generated files**: `spec.json` and the generated route files expose your API's structure. Review them before deploying to a public endpoint.
- **LLM data**: Route source code is sent to your chosen provider's API. Review the provider's data handling and privacy policies before use in sensitive environments.
