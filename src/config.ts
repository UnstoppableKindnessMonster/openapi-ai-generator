import { existsSync } from 'fs';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

export type Provider = 'azure' | 'openai' | 'anthropic';
export type JSDocMode = 'context' | 'exact';

export interface OpenAPIGenConfig {
	provider: Provider;
	output: {
		specPath: string;
		scalarDocs?: boolean;
		scalarPath?: string;
	};
	openapi: {
		title: string;
		version: string;
		description?: string;
		servers?: Array<{ url: string; description?: string }>;
	};
	jsdocMode?: JSDocMode;
	cache?: boolean;
	cacheDir?: string;
	include?: string[];
	exclude?: string[];
}

export interface ResolvedConfig extends Required<OpenAPIGenConfig> {
	output: Required<OpenAPIGenConfig['output']>;
	openapi: Required<OpenAPIGenConfig['openapi']>;
}

const defaults: Omit<ResolvedConfig, 'provider' | 'output' | 'openapi'> = {
	jsdocMode: 'context',
	cache: true,
	cacheDir: '.openapi-cache',
	include: ['src/app/api/**/route.ts'],
	exclude: [],
};

export function resolveConfig(config: OpenAPIGenConfig): ResolvedConfig {
	return {
		...defaults,
		...config,
		output: {
			scalarDocs: false,
			scalarPath: 'src/app/api/docs/route.ts',
			...config.output,
		},
		openapi: {
			description: '',
			servers: [],
			...config.openapi,
		},
	};
}

export async function loadConfig(configPath?: string): Promise<ResolvedConfig> {
	const searchPaths = configPath
		? [configPath]
		: [
				'openapi-gen.config.ts',
				'openapi-gen.config.js',
				'openapi-gen.config.mjs',
				'openapi-gen.config.cjs',
			];

	for (const p of searchPaths) {
		const abs = resolve(process.cwd(), p);
		if (existsSync(abs)) {
			const mod = await importConfig(abs);
			const config: OpenAPIGenConfig = mod.default ?? mod;
			return resolveConfig(config);
		}
	}

	throw new Error('No openapi-gen.config.ts found. Create one at your project root.');
}

async function importConfig(
	filePath: string,
): Promise<{ default?: OpenAPIGenConfig } & OpenAPIGenConfig> {
	// For .ts files, try to use tsx/ts-node if available, else fall back to require
	if (filePath.endsWith('.ts')) {
		return importTypeScriptConfig(filePath);
	}
	const url = pathToFileURL(filePath).href;
	return import(url);
}

async function importTypeScriptConfig(
	filePath: string,
): Promise<{ default?: OpenAPIGenConfig } & OpenAPIGenConfig> {
	// Try dynamic import with tsx register if available
	try {
		// Check if tsx is available
		await import('module');
		// Use tsx/ts-node loader
		const url = pathToFileURL(filePath).href;
		return await import(url);
	} catch {
		// Fall back: try require with ts-node
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			require('ts-node/register');
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			return require(filePath);
		} catch {
			throw new Error(
				`Cannot load TypeScript config file: ${filePath}. ` +
					'Install tsx or ts-node, or use a .js config file.',
			);
		}
	}
}
