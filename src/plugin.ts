import type { GenerateOptions } from "./index.js";

type NextConfigLike = {
  generateBuildId?: unknown;
};

/**
 * Next.js config plugin that runs openapi-ai-generator before each build.
 * Compatible with both webpack and Turbopack (Next.js 16+).
 *
 * @example
 * // next.config.ts
 * import { withOpenAPIGen } from 'openapi-ai-generator/plugin';
 * export default withOpenAPIGen(nextConfig);
 */
export function withOpenAPIGen<T extends NextConfigLike>(
  nextConfig: T = {} as T,
  options: GenerateOptions = {},
): T {
  const existingGenerateBuildId = nextConfig.generateBuildId as
    | (() => Promise<string | null>)
    | null
    | undefined;

  return {
    ...nextConfig,
    async generateBuildId(): Promise<string | null> {
      const { generate } = await import("./index.js");
      await generate(options);
      return existingGenerateBuildId ? existingGenerateBuildId() : null;
    },
  } as T;
}
