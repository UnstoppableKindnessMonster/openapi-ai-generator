import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OpenAPIGenConfig } from "../config.js";

import { loadConfig, resolveConfig } from "../config.js";

// ---------------------------------------------------------------------------
// resolveConfig
// ---------------------------------------------------------------------------

const minimal: OpenAPIGenConfig = {
  provider: "openai",
  output: { specPath: "src/app/api/openapi.json/route.ts" },
  openapi: { title: "Test API", version: "1.0.0", security: [] },
};

describe("resolveConfig", () => {
  it("applies default jsdocMode, cache, cacheDir, include, exclude", () => {
    const cfg = resolveConfig(minimal);
    expect(cfg.jsdocMode).toBe("context");
    expect(cfg.cache).toBe(true);
    expect(cfg.cacheDir).toBe(".openapi-cache");
    expect(cfg.include).toEqual(["src/app/api/**/route.ts"]);
    expect(cfg.exclude).toEqual([]);
  });

  it("applies default output.scalarDocs and output.scalarPath", () => {
    const cfg = resolveConfig(minimal);
    expect(cfg.output.scalarDocs).toBe(false);
    expect(cfg.output.scalarPath).toBe("src/app/api/docs/route.ts");
  });

  it("applies default openapi.description and openapi.servers", () => {
    const cfg = resolveConfig(minimal);
    expect(cfg.openapi.description).toBe("");
    expect(cfg.openapi.servers).toEqual([]);
  });

  it("preserves user-supplied values over defaults", () => {
    const cfg = resolveConfig({
      ...minimal,
      jsdocMode: "exact",
      cache: false,
      cacheDir: ".my-cache",
      include: ["src/app/api/v2/**/route.ts"],
      exclude: ["src/app/api/internal/**/route.ts"],
    });
    expect(cfg.jsdocMode).toBe("exact");
    expect(cfg.cache).toBe(false);
    expect(cfg.cacheDir).toBe(".my-cache");
    expect(cfg.include).toEqual(["src/app/api/v2/**/route.ts"]);
    expect(cfg.exclude).toEqual(["src/app/api/internal/**/route.ts"]);
  });

  it("merges user output fields over defaults", () => {
    const cfg = resolveConfig({
      ...minimal,
      output: {
        specPath: "src/app/api/openapi.json/route.ts",
        scalarDocs: true,
        scalarPath: "src/app/api/swagger/route.ts",
      },
    });
    expect(cfg.output.scalarDocs).toBe(true);
    expect(cfg.output.scalarPath).toBe("src/app/api/swagger/route.ts");
  });

  it("merges user openapi fields over defaults", () => {
    const cfg = resolveConfig({
      ...minimal,
      openapi: {
        title: "My API",
        version: "2.0.0",
        description: "A great API",
        servers: [{ url: "https://api.example.com" }],
        security: [],
      },
    });
    expect(cfg.openapi.description).toBe("A great API");
    expect(cfg.openapi.servers).toEqual([{ url: "https://api.example.com" }]);
  });

  it("preserves all three provider values", () => {
    for (const provider of ["azure", "openai", "anthropic"] as const) {
      const cfg = resolveConfig({ ...minimal, provider });
      expect(cfg.provider).toBe(provider);
    }
  });
});

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------

describe("loadConfig", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("throws when no config file is found", async () => {
    // Point to a path that definitely does not exist
    await expect(
      loadConfig("/nonexistent/path/openapi-gen.config.ts"),
    ).rejects.toThrow("No openapi-gen.config.ts found");
  });

  it("throws when default search paths are all missing", async () => {
    // Override cwd to an empty temp directory so no config is found
    const original = process.cwd;
    process.cwd = () => "/tmp/no-config-here";
    try {
      await expect(loadConfig()).rejects.toThrow(
        "No openapi-gen.config.ts found",
      );
    } finally {
      process.cwd = original;
    }
  });
});
