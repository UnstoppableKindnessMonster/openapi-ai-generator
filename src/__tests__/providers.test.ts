import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getModelId } from '../providers/index.js';

// ---------------------------------------------------------------------------
// getModelId
// ---------------------------------------------------------------------------

describe('getModelId', () => {
	it('returns OPENAI_MODEL env var when set', () => {
		process.env.OPENAI_MODEL = 'gpt-4o-mini';
		expect(getModelId('openai')).toBe('gpt-4o-mini');
		delete process.env.OPENAI_MODEL;
	});

	it('defaults to gpt-4o for openai', () => {
		delete process.env.OPENAI_MODEL;
		expect(getModelId('openai')).toBe('gpt-4o');
	});

	it('returns ANTHROPIC_MODEL env var when set', () => {
		process.env.ANTHROPIC_MODEL = 'claude-opus-4-6';
		expect(getModelId('anthropic')).toBe('claude-opus-4-6');
		delete process.env.ANTHROPIC_MODEL;
	});

	it('defaults to claude-sonnet-4-6 for anthropic', () => {
		delete process.env.ANTHROPIC_MODEL;
		expect(getModelId('anthropic')).toBe('claude-sonnet-4-6');
	});

	it('returns AZURE_OPENAI_DEPLOYMENT env var when set', () => {
		process.env.AZURE_OPENAI_DEPLOYMENT = 'my-gpt4-deployment';
		expect(getModelId('azure')).toBe('my-gpt4-deployment');
		delete process.env.AZURE_OPENAI_DEPLOYMENT;
	});

	it('defaults to "unknown" for azure when env var is missing', () => {
		delete process.env.AZURE_OPENAI_DEPLOYMENT;
		expect(getModelId('azure')).toBe('unknown');
	});
});

// ---------------------------------------------------------------------------
// createModel — env var validation
// ---------------------------------------------------------------------------

describe('createModel', () => {
	// Store original env values so tests are isolated
	const envSnapshot: Record<string, string | undefined> = {};
	const envKeys = [
		'OPENAI_API_KEY',
		'ANTHROPIC_API_KEY',
		'AZURE_OPENAI_ENDPOINT',
		'AZURE_OPENAI_API_KEY',
		'AZURE_OPENAI_DEPLOYMENT',
	];

	beforeEach(() => {
		for (const key of envKeys) {
			envSnapshot[key] = process.env[key];
			delete process.env[key];
		}
	});

	afterEach(() => {
		for (const key of envKeys) {
			if (envSnapshot[key] === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = envSnapshot[key];
			}
		}
	});

	it('throws when OPENAI_API_KEY is missing', async () => {
		const { createModel } = await import('../providers/index.js');
		expect(() => createModel('openai')).toThrow('OPENAI_API_KEY');
	});

	it('throws when ANTHROPIC_API_KEY is missing', async () => {
		const { createModel } = await import('../providers/index.js');
		expect(() => createModel('anthropic')).toThrow('ANTHROPIC_API_KEY');
	});

	it('throws when AZURE_OPENAI_ENDPOINT is missing', async () => {
		const { createModel } = await import('../providers/index.js');
		expect(() => createModel('azure')).toThrow('AZURE_OPENAI_ENDPOINT');
	});

	it('throws when AZURE_OPENAI_API_KEY is missing but endpoint is set', async () => {
		process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com';
		const { createModel } = await import('../providers/index.js');
		expect(() => createModel('azure')).toThrow('AZURE_OPENAI_API_KEY');
	});

	it('throws when AZURE_OPENAI_DEPLOYMENT is missing but endpoint and key are set', async () => {
		process.env.AZURE_OPENAI_ENDPOINT = 'https://example.openai.azure.com';
		process.env.AZURE_OPENAI_API_KEY = 'key123';
		const { createModel } = await import('../providers/index.js');
		expect(() => createModel('azure')).toThrow('AZURE_OPENAI_DEPLOYMENT');
	});
});
