import type { ModelConfig } from "../graph/model-factory.js";
export interface ResolvedConfig {
    project: string;
    outputDir?: string;
    dryRun: boolean;
    skipExisting: boolean;
    modules?: string[];
    model: string;
    concurrency: number;
    /** Multi-model config for new pipeline */
    models?: Partial<ModelConfig>;
    /** Use legacy per-endpoint pipeline */
    legacy: boolean;
}
/**
 * Merges file config (.documentator.json) with CLI flags.
 * CLI flags always take precedence over file config.
 */
export declare function resolveConfig(cliOpts: {
    project?: string;
    outputDir?: string;
    module?: string[];
    concurrency?: string;
    model?: string;
    dryRun?: boolean;
    noSkip?: boolean;
    legacy?: boolean;
    plannerModel?: string;
    writerModel?: string;
}): ResolvedConfig;
