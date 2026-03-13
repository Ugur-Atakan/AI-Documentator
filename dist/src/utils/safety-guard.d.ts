/**
 * Asserts that generated code does not contain database modification operations.
 * Throws if any suspicious pattern is found.
 */
export declare function assertNoDbModification(code: string): void;
/**
 * Asserts that generated code does not contain git operations.
 * Throws if any suspicious pattern is found.
 */
export declare function assertNoGitOperation(code: string): void;
/**
 * Asserts that the output path does not target protected directories.
 * Prevents writing to node_modules, .git, etc.
 */
export declare function assertOutputPathSafe(filePath: string): void;
/**
 * Runs all safety checks on generated code before writing.
 * Call this before every file write operation.
 */
export declare function runSafetyChecks(code: string, outputPath: string): void;
