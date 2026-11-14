/**
 * Shared import/path resolution helpers.
 *
 * `CodeChunk.imports` stores raw import specifiers exactly as they appear in
 * source (`./foo`, `../utils/auth`, `react`), while repository files are
 * repo-relative paths (`src/utils/auth.ts`). Both the blast-radius analysis and
 * the dependency-explorer API need to map one form onto the other, so the
 * resolution rules live here as the single source of truth.
 */

export const SOURCE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.py', '.cpp', '.cc', '.cxx'];

/** Strips a known source extension so `a.ts` and `a` compare equal. */
export function stripSourceExtension(p: string): string {
  for (const ext of SOURCE_EXTENSIONS) {
    if (p.endsWith(ext)) return p.slice(0, -ext.length);
  }
  return p;
}

/** Normalizes a repo-relative path: forward slashes, no leading `./`, extension stripped. */
export function normalizePath(p: string): string {
  let n = p.replace(/\\/g, '/');
  if (n.startsWith('./')) n = n.slice(2);
  return stripSourceExtension(n);
}

/**
 * Resolves a relative import specifier against the importing file's directory.
 * `imports` stores raw specifiers (`./foo`, `../utils/auth`) while repository
 * files are repo-relative paths (`src/utils/auth.ts`), so they must be resolved
 * to a common form before comparison. Returns null for bare/aliased specifiers
 * (`react`, `@octokit/rest`) which cannot be mapped to a repo file.
 */
export function resolveImportSpecifier(spec: string, importerFilePath: string): string | null {
  const s = spec.trim();
  if (!s.startsWith('.')) return null;

  const segments = importerFilePath.replace(/\\/g, '/').split('/').slice(0, -1);
  for (const part of s.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') segments.pop();
    else segments.push(part);
  }
  return normalizePath(segments.join('/'));
}

/**
 * Builds the set of normalized keys a resolved import can match for the given
 * modified files. An `index` file also matches its directory, so `import '../utils'`
 * resolves to a change in `src/utils/index.ts`.
 */
export function buildTargetKeys(modifiedFiles: string[]): Set<string> {
  const keys = new Set<string>();
  for (const f of modifiedFiles) {
    const norm = normalizePath(f);
    if (!norm) continue;
    keys.add(norm);
    const parts = norm.split('/');
    if (parts[parts.length - 1] === 'index') {
      const dir = parts.slice(0, -1).join('/');
      if (dir) keys.add(dir);
    }
  }
  return keys;
}
