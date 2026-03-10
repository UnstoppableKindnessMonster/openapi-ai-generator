import { readFileSync } from 'fs';
import { relative } from 'path';

export interface RouteInfo {
	filePath: string;
	relativePath: string;
	urlPath: string;
	sourceCode: string;
	jsdocComments: string[];
	hasExactJsdoc: boolean;
	exactPathItem?: Record<string, unknown>;
}

export async function scanRoutes(
	include: string[],
	exclude: string[],
	cwd: string = process.cwd(),
): Promise<RouteInfo[]> {
	// Lazy import so that importing this module does not eagerly load fast-glob.
	// This keeps the module lightweight and allows Vitest to mock it cleanly.
	const { default: fg } = await import('fast-glob');
	const files = await fg(include, {
		cwd,
		ignore: exclude,
		absolute: true,
	});

	return files.map((filePath) => parseRoute(filePath, cwd));
}

function parseRoute(filePath: string, cwd: string): RouteInfo {
	const relativePath = relative(cwd, filePath);
	const sourceCode = readFileSync(filePath, 'utf8');
	const urlPath = filePathToUrlPath(relativePath);
	const { jsdocComments, hasExactJsdoc, exactPathItem } = extractJsdoc(sourceCode);

	return {
		filePath,
		relativePath,
		urlPath,
		sourceCode,
		jsdocComments,
		hasExactJsdoc,
		exactPathItem,
	};
}

/**
 * Convert a Next.js route file path to an OpenAPI URL path.
 * e.g. src/app/api/users/[id]/route.ts -> /api/users/{id}
 */
export function filePathToUrlPath(filePath: string): string {
	// Normalize separators
	let path = filePath.replace(/\\/g, '/');

	// Remove leading src/ or app/ prefixes
	path = path.replace(/^(src\/)?app\//, '');

	// Remove trailing /route.ts or /route.js
	path = path.replace(/\/route\.(ts|tsx|js|jsx)$/, '');

	// Convert Next.js dynamic segments [param] to OpenAPI {param}
	path = path.replace(/\[([^\]]+)\]/g, (_, param) => {
		// Handle catch-all [...param] and optional [[...param]]
		if (param.startsWith('...')) {
			return `{${param.slice(3)}}`;
		}
		return `{${param}}`;
	});

	// Ensure leading slash
	if (!path.startsWith('/')) {
		path = `/${path}`;
	}

	return path;
}

interface JsdocResult {
	jsdocComments: string[];
	hasExactJsdoc: boolean;
	exactPathItem?: Record<string, unknown>;
}

function extractJsdoc(sourceCode: string): JsdocResult {
	// Match all JSDoc comment blocks /** ... */
	const jsdocRegex = /\/\*\*([\s\S]*?)\*\//g;
	const jsdocComments: string[] = [];
	let hasExactJsdoc = false;
	let exactPathItem: Record<string, unknown> | undefined;

	const match: RegExpExecArray | null = jsdocRegex.exec(sourceCode);
	while (match !== null) {
		const comment = match[0];
		jsdocComments.push(comment);

		// Check for @openapi-exact tag
		if (/@openapi-exact/.test(comment)) {
			hasExactJsdoc = true;
			// Try to extract the JSON from @openapi tag
			const openapiMatch = comment.match(/@openapi\s+([\s\S]*?)(?=\s*\*\/|\s*\*\s*@)/);
			if (openapiMatch) {
				try {
					// Clean up JSDoc asterisks from the JSON
					const jsonStr = openapiMatch[1]
						.split('\n')
						.map((line) => line.replace(/^\s*\*\s?/, ''))
						.join('\n')
						.trim();
					exactPathItem = JSON.parse(jsonStr);
				} catch {
					// If JSON parse fails, fall through to LLM
					hasExactJsdoc = false;
				}
			}
		}
	}

	return { jsdocComments, hasExactJsdoc, exactPathItem };
}
