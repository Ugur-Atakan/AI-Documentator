import * as path from "path";
const DB_PATTERNS = [
    /prisma\.\w+\.create\(/,
    /prisma\.\w+\.update\(/,
    /prisma\.\w+\.delete\(/,
    /prisma\.\w+\.upsert\(/,
    /prisma\.\$executeRaw/,
    /prisma\.\$queryRaw/,
    /\.save\(\)/,
    /\.remove\(\)/,
    /\.destroy\(\)/,
];
const GIT_PATTERNS = [
    /git\s+(push|pull|commit|reset|checkout|merge|rebase)/i,
    /execSync\(\s*['"`]git\s/,
    /exec\(\s*['"`]git\s/,
];
const UNSAFE_DIRS = [
    "node_modules",
    ".git",
    ".env",
    "dist",
    ".next",
];
/**
 * Asserts that generated code does not contain database modification operations.
 * Throws if any suspicious pattern is found.
 */
export function assertNoDbModification(code) {
    for (const pattern of DB_PATTERNS) {
        if (pattern.test(code)) {
            throw new Error(`Safety violation: Generated code contains database modification pattern: ${pattern.source}`);
        }
    }
}
/**
 * Asserts that generated code does not contain git operations.
 * Throws if any suspicious pattern is found.
 */
export function assertNoGitOperation(code) {
    for (const pattern of GIT_PATTERNS) {
        if (pattern.test(code)) {
            throw new Error(`Safety violation: Generated code contains git operation pattern: ${pattern.source}`);
        }
    }
}
/**
 * Asserts that the output path does not target protected directories.
 * Prevents writing to node_modules, .git, etc.
 */
export function assertOutputPathSafe(filePath) {
    const normalized = path.normalize(filePath);
    const parts = normalized.split(path.sep);
    for (const unsafeDir of UNSAFE_DIRS) {
        if (parts.includes(unsafeDir)) {
            throw new Error(`Safety violation: Output path targets protected directory "${unsafeDir}": ${filePath}`);
        }
    }
}
/**
 * Runs all safety checks on generated code before writing.
 * Call this before every file write operation.
 */
export function runSafetyChecks(code, outputPath) {
    assertNoDbModification(code);
    assertNoGitOperation(code);
    assertOutputPathSafe(outputPath);
}
