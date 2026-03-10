import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hold a direct reference to the mock function so we never import fast-glob
// itself — even a mocked static import triggers its ESM initializer in Vitest.
const mockFg = vi.fn();
vi.mock('fast-glob', () => ({ default: mockFg }));

import { filePathToUrlPath, scanRoutes } from '../scanner.js';


// ---------------------------------------------------------------------------
// filePathToUrlPath — pure function, no I/O
// ---------------------------------------------------------------------------

describe('filePathToUrlPath', () => {
	it('converts a simple route', () => {
		expect(filePathToUrlPath('src/app/api/users/route.ts')).toBe('/api/users');
	});

	it('strips the src/app prefix', () => {
		expect(filePathToUrlPath('src/app/api/health/route.ts')).toBe('/api/health');
	});

	it('strips an app prefix without src/', () => {
		expect(filePathToUrlPath('app/api/health/route.ts')).toBe('/api/health');
	});

	it('converts a dynamic [id] segment to {id}', () => {
		expect(filePathToUrlPath('src/app/api/users/[id]/route.ts')).toBe('/api/users/{id}');
	});

	it('converts multiple dynamic segments', () => {
		expect(
			filePathToUrlPath('src/app/api/posts/[postId]/comments/[commentId]/route.ts'),
		).toBe('/api/posts/{postId}/comments/{commentId}');
	});

	it('converts a catch-all [...slug] segment to {slug}', () => {
		expect(filePathToUrlPath('src/app/api/files/[...path]/route.ts')).toBe('/api/files/{path}');
	});

	it('accepts .js route files', () => {
		expect(filePathToUrlPath('src/app/api/users/route.js')).toBe('/api/users');
	});

	it('accepts .tsx route files', () => {
		expect(filePathToUrlPath('src/app/api/users/route.tsx')).toBe('/api/users');
	});

	it('handles Windows-style backslashes', () => {
		expect(filePathToUrlPath('src\\app\\api\\users\\route.ts')).toBe('/api/users');
	});

	it('ensures a leading slash', () => {
		expect(filePathToUrlPath('src/app/api/ping/route.ts').startsWith('/')).toBe(true);
	});

	it('handles deeply nested routes', () => {
		expect(filePathToUrlPath('src/app/api/v2/admin/users/[id]/roles/route.ts')).toBe(
			'/api/v2/admin/users/{id}/roles',
		);
	});
});

// ---------------------------------------------------------------------------
// scanRoutes — glob is mocked; real temp files satisfy readFileSync
// ---------------------------------------------------------------------------

describe('scanRoutes', () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), 'scanner-test-'));
		mockFg.mockReset();
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	/** Write a real file so readFileSync can read it. */
	function writeRoute(relPath: string, content: string): string {
		const abs = join(tmpDir, relPath);
		mkdirSync(dirname(abs), { recursive: true });
		writeFileSync(abs, content, 'utf8');
		return abs;
	}

	function mockGlob(paths: string[]): void {
		mockFg.mockResolvedValue(paths);
	}

	it('returns an empty array when glob finds no files', async () => {
		mockGlob([]);
		const routes = await scanRoutes(['src/app/api/**/route.ts'], [], tmpDir);
		expect(routes).toEqual([]);
	});

	it('returns one RouteInfo per file returned by glob', async () => {
		const abs = writeRoute('src/app/api/users/route.ts', 'export async function GET() {}');
		mockGlob([abs]);

		const routes = await scanRoutes(['src/app/api/**/route.ts'], [], tmpDir);

		expect(routes).toHaveLength(1);
		expect(routes[0].urlPath).toBe('/api/users');
		expect(routes[0].sourceCode).toBe('export async function GET() {}');
		expect(routes[0].relativePath).toBe('src/app/api/users/route.ts');
	});

	it('returns multiple RouteInfos for multiple files', async () => {
		const a = writeRoute('src/app/api/users/route.ts', 'export async function GET() {}');
		const b = writeRoute('src/app/api/posts/route.ts', 'export async function GET() {}');
		mockGlob([a, b]);

		const routes = await scanRoutes(['src/app/api/**/route.ts'], [], tmpDir);
		expect(routes).toHaveLength(2);
	});

	it('passes exclude patterns through to glob', async () => {
		mockGlob([]);

		await scanRoutes(
			['src/app/api/**/route.ts'],
			['src/app/api/openapi.json/route.ts'],
			tmpDir,
		);

		expect(mockFg).toHaveBeenCalledWith(
			expect.any(Array),
			expect.objectContaining({ ignore: ['src/app/api/openapi.json/route.ts'] }),
		);
	});

	it('detects @openapi-exact and parses the PathItem JSON', async () => {
		const source = `
/**
 * @openapi-exact
 * @openapi {"get":{"operationId":"ping","responses":{"200":{"description":"OK"}}}}
 */
export async function GET() {}`.trim();
		const abs = writeRoute('src/app/api/ping/route.ts', source);
		mockGlob([abs]);

		const routes = await scanRoutes(['src/app/api/**/route.ts'], [], tmpDir);

		expect(routes[0].hasExactJsdoc).toBe(true);
		expect(routes[0].exactPathItem).toMatchObject({ get: { operationId: 'ping' } });
	});

	it('sets hasExactJsdoc false when @openapi-exact is absent', async () => {
		const abs = writeRoute(
			'src/app/api/users/route.ts',
			'/** @param id user id */\nexport async function GET() {}',
		);
		mockGlob([abs]);

		const routes = await scanRoutes(['src/app/api/**/route.ts'], [], tmpDir);

		expect(routes[0].hasExactJsdoc).toBe(false);
		expect(routes[0].exactPathItem).toBeUndefined();
	});

	it('extracts multiple JSDoc comment blocks', async () => {
		const source = `/** First */\nexport async function GET() {}\n/** Second */\nexport async function POST() {}`;
		const abs = writeRoute('src/app/api/items/route.ts', source);
		mockGlob([abs]);

		const routes = await scanRoutes(['src/app/api/**/route.ts'], [], tmpDir);

		expect(routes[0].jsdocComments).toHaveLength(2);
	});

	it('sets hasExactJsdoc false when @openapi JSON is invalid, falling back to LLM', async () => {
		const source = `
/**
 * @openapi-exact
 * @openapi {this is not valid json}
 */
export async function GET() {}`.trim();
		const abs = writeRoute('src/app/api/broken/route.ts', source);
		mockGlob([abs]);

		const routes = await scanRoutes(['src/app/api/**/route.ts'], [], tmpDir);

		expect(routes[0].hasExactJsdoc).toBe(false);
		expect(routes[0].exactPathItem).toBeUndefined();
	});

	it('infers the correct urlPath for a dynamic segment', async () => {
		const abs = writeRoute('src/app/api/users/[id]/route.ts', 'export async function GET() {}');
		mockGlob([abs]);

		const routes = await scanRoutes(['src/app/api/**/route.ts'], [], tmpDir);

		expect(routes[0].urlPath).toBe('/api/users/{id}');
	});
});
