import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RouteInfo } from '../scanner.js';

// ---------------------------------------------------------------------------
// Module mocks — hoisted before any imports that touch these modules
// ---------------------------------------------------------------------------

vi.mock('../providers/index.js', () => ({
	createModel: vi.fn(),
	getModelId: vi.fn(() => 'gpt-4o'),
}));

vi.mock('ai', () => ({
	generateText: vi.fn(),
}));

import { analyzeRoutes } from '../analyzer.js';
import { generateText } from 'ai';
import { createModel, getModelId } from '../providers/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRoute(overrides: Partial<RouteInfo> = {}): RouteInfo {
	return {
		filePath: '/project/src/app/api/users/route.ts',
		relativePath: 'src/app/api/users/route.ts',
		urlPath: '/api/users',
		sourceCode: 'export async function GET() { return Response.json([]) }',
		jsdocComments: [],
		hasExactJsdoc: false,
		...overrides,
	};
}

const defaultOptions = {
	provider: 'openai' as const,
	jsdocMode: 'context' as const,
	cache: false,
	cacheDir: '',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('analyzeRoutes', () => {
	beforeEach(() => {
		vi.resetAllMocks();
		vi.mocked(getModelId).mockReturnValue('gpt-4o');
		vi.mocked(createModel).mockReturnValue({} as ReturnType<typeof createModel>);
	});

	it('uses exactPathItem directly when hasExactJsdoc is true, skipping LLM', async () => {
		const exactPathItem = { get: { operationId: 'listUsers', summary: 'List users' } };
		const route = makeRoute({ hasExactJsdoc: true, exactPathItem });

		const results = await analyzeRoutes([route], defaultOptions);

		expect(results).toHaveLength(1);
		expect(results[0].pathItem).toEqual(exactPathItem);
		expect(results[0].skippedLLM).toBe(true);
		expect(vi.mocked(generateText)).not.toHaveBeenCalled();
	});

	it('calls generateText when there is no exact JSDoc', async () => {
		const pathItem = { get: { operationId: 'getUsers' } };
		vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(pathItem) } as Awaited<ReturnType<
			typeof generateText
		>>);

		const results = await analyzeRoutes([makeRoute()], defaultOptions);

		expect(vi.mocked(generateText)).toHaveBeenCalledOnce();
		expect(results[0].pathItem).toEqual(pathItem);
		expect(results[0].fromCache).toBe(false);
		expect(results[0].skippedLLM).toBe(false);
	});

	it('reads from cache and skips LLM on a second call', async () => {
		let tmpDir: string;
		tmpDir = mkdtempSync(join(tmpdir(), 'analyzer-cache-test-'));

		try {
			const pathItem = { get: { operationId: 'cachedOp' } };
			vi.mocked(generateText).mockResolvedValue({ text: JSON.stringify(pathItem) } as Awaited<ReturnType<
				typeof generateText
			>>);

			const cacheOptions = { ...defaultOptions, cache: true, cacheDir: tmpDir };
			const route = makeRoute();

			// First call — hits LLM and populates cache
			await analyzeRoutes([route], cacheOptions);
			expect(vi.mocked(generateText)).toHaveBeenCalledOnce();

			vi.mocked(generateText).mockClear();

			// Second call — should hit cache
			const results = await analyzeRoutes([route], cacheOptions);
			expect(vi.mocked(generateText)).not.toHaveBeenCalled();
			expect(results[0].fromCache).toBe(true);
			expect(results[0].pathItem).toEqual(pathItem);
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it('strips markdown code fences from LLM response', async () => {
		const pathItem = { get: { operationId: 'fenced' } };
		vi.mocked(generateText).mockResolvedValue({
			text: '```json\n' + JSON.stringify(pathItem) + '\n```',
		} as Awaited<ReturnType<typeof generateText>>);

		const results = await analyzeRoutes([makeRoute()], defaultOptions);
		expect(results[0].pathItem).toEqual(pathItem);
	});

	it('returns an empty PathItem and warns when LLM returns invalid JSON', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.mocked(generateText).mockResolvedValue({ text: 'not json at all' } as Awaited<ReturnType<
			typeof generateText
		>>);

		const results = await analyzeRoutes([makeRoute()], defaultOptions);
		expect(results[0].pathItem).toEqual({});
		expect(warn).toHaveBeenCalledWith(
			expect.stringContaining('Failed to parse'),
			expect.anything(),
		);
		warn.mockRestore();
	});

	it('handles a content filter 400 error gracefully', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const filterError = Object.assign(new Error('Output blocked by content filtering policy'), {
			status: 400,
		});
		vi.mocked(generateText).mockRejectedValue(filterError);

		const results = await analyzeRoutes([makeRoute()], defaultOptions);
		expect(results[0].pathItem).toEqual({});
		expect(warn).toHaveBeenCalledWith(expect.stringContaining('Content filter'));
		warn.mockRestore();
	});

	it('handles a content_filter error type gracefully', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		vi.mocked(generateText).mockRejectedValue(new Error('content_filter triggered'));

		const results = await analyzeRoutes([makeRoute()], defaultOptions);
		expect(results[0].pathItem).toEqual({});
		warn.mockRestore();
	});

	it('re-throws non-content-filter errors', async () => {
		vi.mocked(generateText).mockRejectedValue(new Error('Network timeout'));

		await expect(analyzeRoutes([makeRoute()], defaultOptions)).rejects.toThrow('Network timeout');
	});

	it('processes multiple routes independently', async () => {
		const routeA = makeRoute({ urlPath: '/api/users', sourceCode: 'GET users' });
		const routeB = makeRoute({ urlPath: '/api/posts', sourceCode: 'GET posts' });

		vi.mocked(generateText)
			.mockResolvedValueOnce({ text: '{"get":{"operationId":"listUsers"}}' } as Awaited<ReturnType<
				typeof generateText
			>>)
			.mockResolvedValueOnce({ text: '{"get":{"operationId":"listPosts"}}' } as Awaited<ReturnType<
				typeof generateText
			>>);

		const results = await analyzeRoutes([routeA, routeB], defaultOptions);

		expect(results).toHaveLength(2);
		expect(results[0].urlPath).toBe('/api/users');
		expect(results[1].urlPath).toBe('/api/posts');
		expect(vi.mocked(generateText)).toHaveBeenCalledTimes(2);
	});

	it('uses getModelId for the cache key', async () => {
		vi.mocked(getModelId).mockReturnValue('claude-sonnet-4-6');
		vi.mocked(generateText).mockResolvedValue({ text: '{}' } as Awaited<ReturnType<typeof generateText>>);

		await analyzeRoutes([makeRoute()], { ...defaultOptions, provider: 'anthropic' });
		expect(vi.mocked(getModelId)).toHaveBeenCalledWith('anthropic');
	});
});
