import { Command } from 'commander';

import type { Provider } from './config.js';

import { generate } from './index.js';

const program = new Command();

program
	.name('openapi-ai-generator')
	.description('Generate OpenAPI 3.1 specs from Next.js API routes using AI')
	.version('0.1.0');

program
	.command('generate')
	.description('Scan Next.js API routes and generate an OpenAPI spec')
	.option('-c, --config <path>', 'Path to config file (default: openapi-gen.config.ts)')
	.option('-p, --provider <provider>', 'Override provider (azure | openai | anthropic)')
	.option('--no-cache', 'Disable caching (always re-analyze all routes)')
	.action(async (opts: { config?: string; provider?: string; cache: boolean }) => {
		try {
			const result = await generate({
				config: opts.config,
				provider: opts.provider as Provider | undefined,
				cache: opts.cache,
			});

			console.log(`\n✓ OpenAPI spec generated successfully`);
			console.log(`  Routes analyzed:    ${result.routesAnalyzed}`);
			console.log(`  From cache:         ${result.routesFromCache}`);
			console.log(
				`  LLM calls made:     ${result.routesAnalyzed - result.routesFromCache - (result.routesSkippedLLM - result.routesFromCache)}`,
			);
			console.log(`  Spec written to:    ${result.specPath}`);
		} catch (err) {
			console.error('[openapi-ai-generator] Error:', err instanceof Error ? err.message : err);
			process.exit(1);
		}
	});

program.parse();
