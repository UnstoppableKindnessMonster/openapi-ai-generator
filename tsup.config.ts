import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      plugin: 'src/plugin.ts',
    },
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    external: ['next'],
  },
  {
    entry: {
      cli: 'src/cli.ts',
    },
    format: ['cjs'],
    dts: false,
    sourcemap: true,
    banner: {
      js: '#!/usr/bin/env node',
    },
    external: ['next'],
  },
]);
