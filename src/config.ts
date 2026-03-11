import { existsSync } from "fs";
import { resolve } from "path";
import { pathToFileURL } from "url";

export type Provider = "azure" | "openai" | "anthropic";
export type JSDocMode = "context" | "exact";

export interface OpenAPIGenConfig {
  provider: Provider;
  output: {
    specPath: string;
    scalarDocs?: boolean;
    scalarPath?: string;
    scalarConfig?: Record<string, unknown>;
  };
  openapi: {
    title: string;
    version: string;
    description?: string;
    servers?: Array<{ url: string; description?: string }>;
    security: Array<{ [key: string]: string[] }>;
    components?: {
      securitySchemes?: {
        [key: string]: {
          type: string;
          in: string;
          name: string;
        };
      };
    };
  };
  jsdocMode?: JSDocMode;
  cache?: boolean;
  cacheDir?: string;
  include?: string[];
  exclude?: string[];
  /**
   * Path(s) to .env files to load before running. Defaults to ['.env', '.env.local'].
   * Set to false to disable automatic .env loading.
   */
  envFile?: string | string[] | false;
  /**
   * Safeguards for LLM usage per route analysis call.
   */
  limits?: {
    /**
     * Maximum number of output tokens per LLM call. Defaults to 4000.
     */
    maxTokens?: number;
    /**
     * Timeout in milliseconds per LLM call. Defaults to 60000 (60s).
     */
    timeoutMs?: number;
  };
}

export interface ResolvedLimits {
  maxTokens: number;
  timeoutMs: number;
}

export interface ResolvedConfig extends Omit<
  Required<OpenAPIGenConfig>,
  "envFile" | "limits"
> {
  output: Required<OpenAPIGenConfig["output"]>;
  openapi: Required<OpenAPIGenConfig["openapi"]>;
  envFile: string[] | false;
  limits: ResolvedLimits;
}

const defaults: Omit<ResolvedConfig, "provider" | "output" | "openapi"> = {
  jsdocMode: "context",
  cache: true,
  cacheDir: ".openapi-cache",
  include: ["src/app/api/**/route.ts"],
  exclude: [],
  envFile: [".env", ".env.local"],
  limits: {
    maxTokens: 4000,
    timeoutMs: 60_000,
  },
};

export function resolveConfig(config: OpenAPIGenConfig): ResolvedConfig {
  let envFile: string[] | false;
  if (config.envFile === false) {
    envFile = false;
  } else if (typeof config.envFile === "string") {
    envFile = [config.envFile];
  } else {
    envFile = config.envFile ?? (defaults.envFile as string[]);
  }

  return {
    ...defaults,
    ...config,
    envFile,
    limits: {
      ...defaults.limits,
      ...config.limits,
    },
    output: {
      scalarDocs: false,
      scalarPath: "src/app/api/docs/route.ts",
      scalarConfig: {},
      ...config.output,
    },
    openapi: {
      description: "",
      servers: [],
      components: {},
      ...config.openapi,
    },
  };
}

export async function loadConfig(configPath?: string): Promise<ResolvedConfig> {
  const searchPaths = configPath
    ? [configPath]
    : [
        "openapi-gen.config.ts",
        "openapi-gen.config.js",
        "openapi-gen.config.mjs",
        "openapi-gen.config.cjs",
      ];

  for (const p of searchPaths) {
    const abs = resolve(process.cwd(), p);
    if (existsSync(abs)) {
      const mod = await importConfig(abs);
      const config: OpenAPIGenConfig = mod.default ?? mod;
      return resolveConfig(config);
    }
  }

  throw new Error(
    "No openapi-gen.config.ts found. Create one at your project root.",
  );
}

async function importConfig(
  filePath: string,
): Promise<{ default?: OpenAPIGenConfig } & OpenAPIGenConfig> {
  // For .ts files, try to use tsx/ts-node if available, else fall back to require
  if (filePath.endsWith(".ts")) {
    return importTypeScriptConfig(filePath);
  }
  const url = pathToFileURL(filePath).href;
  return import(url);
}

async function importTypeScriptConfig(
  filePath: string,
): Promise<{ default?: OpenAPIGenConfig } & OpenAPIGenConfig> {
  // Use tsx (bundled as a dependency) to register CJS TypeScript hooks
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("tsx/cjs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require(filePath);
}
