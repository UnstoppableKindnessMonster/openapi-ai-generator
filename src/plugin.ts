import type { GenerateOptions } from './index.js';

type NextConfig = Record<string, unknown>;

interface WebpackCompiler {
	hooks: {
		beforeRun: {
			tapAsync: (
				name: string,
				fn: (compiler: WebpackCompiler, callback: (err?: Error) => void) => void,
			) => void;
		};
	};
}

/**
 * Next.js config plugin that runs openapi-ai-generator before each build.
 *
 * @example
 * // next.config.ts
 * import { withOpenAPIGen } from 'openapi-ai-generator/plugin';
 * export default withOpenAPIGen(nextConfig);
 */
export function withOpenAPIGen(
	nextConfig: NextConfig = {},
	options: GenerateOptions = {},
): NextConfig {
	return {
		...nextConfig,
		webpack(
			config: { plugins?: unknown[] } & Record<string, unknown>,
			context: Record<string, unknown>,
		) {
			// Add webpack plugin that runs before build
			const existingPlugins = (config.plugins as unknown[]) ?? [];
			config.plugins = [...existingPlugins, new OpenAPIGenWebpackPlugin(options)];

			// Chain existing webpack config
			const existingWebpack = nextConfig.webpack as
				| ((cfg: typeof config, ctx: typeof context) => typeof config)
				| undefined;

			if (existingWebpack) {
				return existingWebpack(config, context);
			}

			return config;
		},
	};
}

class OpenAPIGenWebpackPlugin {
	private readonly options: GenerateOptions;
	private hasRun = false;

	constructor(options: GenerateOptions) {
		this.options = options;
	}

	apply(compiler: WebpackCompiler): void {
		compiler.hooks.beforeRun.tapAsync('OpenAPIGenPlugin', async (_compiler, callback) => {
			// Only run once per build (not for each chunk compilation)
			if (this.hasRun) {
				callback();
				return;
			}
			this.hasRun = true;

			try {
				const { generate } = await import('./index.js');
				await generate(this.options);
				callback();
			} catch (err) {
				callback(err instanceof Error ? err : new Error(String(err)));
			}
		});
	}
}
