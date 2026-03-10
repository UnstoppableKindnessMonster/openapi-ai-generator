export type { JSDocMode, OpenAPIGenConfig, Provider, ResolvedConfig } from './config.js';

export { analyzeRoutes } from './analyzer.js';
export { loadConfig, resolveConfig } from './config.js';
export { assembleSpec, writeOutputFiles } from './generator.js';
export { filePathToUrlPath, scanRoutes } from './scanner.js';

import { resolve } from 'node:path';
import type { OpenAPIGenConfig } from './config.js';

import { analyzeRoutes } from './analyzer.js';
import { loadConfig } from './config.js';
import { assembleSpec, writeOutputFiles } from './generator.js';
import { scanRoutes } from './scanner.js';

export interface GenerateOptions {
	config?: string;
	provider?: OpenAPIGenConfig['provider'];
	cache?: boolean;
	cwd?: string;
}

export interface GenerateResult {
	routesAnalyzed: number;
	routesFromCache: number;
	routesSkippedLLM: number;
	specPath: string;
}

export async function generate(options: GenerateOptions = {}): Promise<GenerateResult> {
	const cwd = options.cwd ?? process.cwd();
	const config = await loadConfig(options.config);

	// Allow CLI overrides
	if (options.provider) config.provider = options.provider;
	if (options.cache === false) config.cache = false;

	// Load .env files before provider env vars are read
	if (config.envFile !== false) {
		const { config: dotenvConfig } = await import('dotenv');
		for (const file of config.envFile) {
			dotenvConfig({ path: resolve(cwd, file), override: false });
		}
	}

	console.log(`[openapi-ai-generator] Scanning routes...`);
	const routes = await scanRoutes(config.include, config.exclude, cwd);
	console.log(`[openapi-ai-generator] Found ${routes.length} route(s)`);

	console.log(`[openapi-ai-generator] Analyzing routes with provider: ${config.provider}`);
	const analyzed = await analyzeRoutes(routes, {
		provider: config.provider,
		jsdocMode: config.jsdocMode,
		cache: config.cache,
		cacheDir: config.cacheDir,
	});

	const fromCache = analyzed.filter((r) => r.fromCache).length;
	const skippedLLM = analyzed.filter((r) => r.skippedLLM).length;
	console.log(
		`[openapi-ai-generator] ${analyzed.length} routes analyzed (${fromCache} from cache, ${skippedLLM - fromCache} exact JSDoc)`,
	);

	const spec = assembleSpec(config, analyzed);
	writeOutputFiles(config, spec, cwd);

	console.log(`[openapi-ai-generator] Spec written to ${config.output.specPath}`);
	if (config.output.scalarDocs) {
		console.log(`[openapi-ai-generator] Scalar docs written to ${config.output.scalarPath}`);
	}

	return {
		routesAnalyzed: analyzed.length,
		routesFromCache: fromCache,
		routesSkippedLLM: skippedLLM,
		specPath: config.output.specPath,
	};
}
