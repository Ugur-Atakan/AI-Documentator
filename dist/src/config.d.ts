export interface DocGenConfig {
    /** Path to the NestJS project root */
    project: string;
    /** Directory to write generated files (relative to cwd or absolute).
     *  If omitted, files are written next to their source controllers. */
    outputDir?: string;
    /** When true, print generated code to stdout instead of writing files */
    dryRun?: boolean;
    /** Skip generation for endpoints whose output file already exists */
    skipExisting?: boolean;
    /** Only process controllers whose file path matches one of these substrings */
    modules?: string[];
    /** AI model to use. Defaults to gemini-2.5-flash */
    model?: string;
}
export declare const DEFAULT_CONFIG: Required<Omit<DocGenConfig, "project" | "modules">>;
