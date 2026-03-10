import type { OpenAPIGenConfig } from 'openapi-ai-generator';

export default {
  provider: 'azure', // 'azure' | 'openai' | 'anthropic'
  output: {
    specPath: 'src/app/api/openapi.json/route.ts', // serves GET /api/openapi.json
    scalarDocs: false,
    scalarPath: 'src/app/api/docs/route.ts',
  },
  openapi: {
    title: 'My API',
    version: '1.0.0',
    description: '',
    servers: [],
  },
  jsdocMode: 'context', // 'context' | 'exact'
  cache: true,
  cacheDir: '.openapi-cache',
  include: ['src/app/api/**/route.ts'],
  exclude: ['src/app/api/openapi.json/route.ts', 'src/app/api/docs/route.ts'],
} satisfies OpenAPIGenConfig;
