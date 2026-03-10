import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export interface CacheEntry {
	hash: string;
	pathItem: Record<string, unknown>;
	cachedAt: string;
}

export function computeHash(content: string, provider: string, modelId: string): string {
	return createHash('sha256').update(content).update(provider).update(modelId).digest('hex');
}

export class RouteCache {
	private readonly cacheDir: string;

	constructor(cacheDir: string) {
		this.cacheDir = cacheDir;
	}

	private ensureDir(): void {
		if (!existsSync(this.cacheDir)) {
			mkdirSync(this.cacheDir, { recursive: true });
		}
	}

	get(hash: string): Record<string, unknown> | null {
		const filePath = join(this.cacheDir, `${hash}.json`);
		if (!existsSync(filePath)) return null;
		try {
			const entry: CacheEntry = JSON.parse(readFileSync(filePath, 'utf8'));
			return entry.pathItem;
		} catch {
			return null;
		}
	}

	set(hash: string, pathItem: Record<string, unknown>): void {
		this.ensureDir();
		const entry: CacheEntry = {
			hash,
			pathItem,
			cachedAt: new Date().toISOString(),
		};
		const filePath = join(this.cacheDir, `${hash}.json`);
		writeFileSync(filePath, JSON.stringify(entry, null, 2), 'utf8');
	}
}
