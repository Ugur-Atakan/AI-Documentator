import type { ExecutorResult } from "../executor/parallel-executor.js";
import type { EndpointTask } from "../types/endpoint.js";
export declare function printBanner(): void;
export declare function printConfig(opts: {
    project: string;
    outputDir?: string;
    dryRun: boolean;
    skipExisting: boolean;
    modules?: string[];
    model: string;
    concurrency: number;
    endpointCount: number;
    pipelineMode?: string;
}): void;
export declare function printEndpointPreview(tasks: EndpointTask[]): void;
export declare function printSummary(result: ExecutorResult): void;
