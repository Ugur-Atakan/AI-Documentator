interface OutputSuggestion {
    path: string;
    label: string;
    reason: string;
}
/**
 * Analyzes a NestJS project structure and suggests the best output directories.
 * Returns suggestions ranked by relevance.
 */
export declare function suggestOutputDirs(projectRoot: string): OutputSuggestion[];
export {};
