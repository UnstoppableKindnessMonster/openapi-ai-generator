import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { computeHash, RouteCache } from '../cache.js';

// ---------------------------------------------------------------------------
// computeHash
// ---------------------------------------------------------------------------

describe('computeHash', () => {
	it('returns a 64-char hex string', () => {
		const hash = computeHash('content', 'openai', 'gpt-4o');
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});

	it('returns the same hash for the same inputs', () => {
		const a = computeHash('abc', 'openai', 'gpt-4o');
		const b = computeHash('abc', 'openai', 'gpt-4o');
		expect(a).toBe(b);
	});

	it('returns a different hash when content changes', () => {
		const a = computeHash('abc', 'openai', 'gpt-4o');
		const b = computeHash('xyz', 'openai', 'gpt-4o');
		expect(a).not.toBe(b);
	});

	it('returns a different hash when provider changes', () => {
		const a = computeHash('abc', 'openai', 'gpt-4o');
		const b = computeHash('abc', 'anthropic', 'gpt-4o');
		expect(a).not.toBe(b);
	});

	it('returns a different hash when modelId changes', () => {
		const a = computeHash('abc', 'openai', 'gpt-4o');
		const b = computeHash('abc', 'openai', 'gpt-4o-mini');
		expect(a).not.toBe(b);
	});
});

// ---------------------------------------------------------------------------
// RouteCache
// ---------------------------------------------------------------------------

describe('RouteCache', () => {
	let tmpDir: string;
	let cache: RouteCache;

	beforeEach(() => {
		tmpDir = mkdtempSync(join(tmpdir(), 'openapi-cache-test-'));
		cache = new RouteCache(tmpDir);
	});

	afterEach(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it('returns null for a hash that has never been stored', () => {
		expect(cache.get('nonexistent')).toBeNull();
	});

	it('stores and retrieves a PathItem', () => {
		const pathItem = { get: { operationId: 'listUsers', summary: 'List users' } };
		cache.set('abc123', pathItem);
		expect(cache.get('abc123')).toEqual(pathItem);
	});

	it('creates the cache directory if it does not exist', () => {
		const subDir = join(tmpDir, 'nested', 'cache');
		const nested = new RouteCache(subDir);
		nested.set('hash1', { get: {} });
		expect(nested.get('hash1')).toEqual({ get: {} });
	});

	it('overwrites an existing entry', () => {
		cache.set('key', { get: { summary: 'old' } });
		cache.set('key', { get: { summary: 'new' } });
		expect(cache.get('key')).toEqual({ get: { summary: 'new' } });
	});

	it('returns null for a corrupt JSON file', () => {
		const hash = 'corrupt';
		writeFileSync(join(tmpDir, `${hash}.json`), '{not valid json', 'utf8');
		expect(cache.get(hash)).toBeNull();
	});

	it('each hash maps to an isolated entry', () => {
		cache.set('hash-a', { get: { summary: 'A' } });
		cache.set('hash-b', { get: { summary: 'B' } });
		expect(cache.get('hash-a')).toEqual({ get: { summary: 'A' } });
		expect(cache.get('hash-b')).toEqual({ get: { summary: 'B' } });
	});

	it('stores nested and complex PathItem objects', () => {
		const pathItem = {
			get: {
				operationId: 'getUser',
				parameters: [{ name: 'id', in: 'path', required: true }],
				responses: {
					'200': {
						description: 'OK',
						content: { 'application/json': { schema: { type: 'object' } } },
					},
					'404': { description: 'Not found' },
				},
			},
		};
		cache.set('complex', pathItem);
		expect(cache.get('complex')).toEqual(pathItem);
	});
});
