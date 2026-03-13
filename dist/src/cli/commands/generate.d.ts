export interface GenerateOptions {
    project?: string;
    outputDir?: string;
    module?: string[];
    concurrency?: string;
    model?: string;
    dryRun?: boolean;
    noSkip?: boolean;
    retry?: boolean;
    legacy?: boolean;
    plannerModel?: string;
    writerModel?: string;
}
export declare function generateCommand(opts: GenerateOptions): Promise<void>;
