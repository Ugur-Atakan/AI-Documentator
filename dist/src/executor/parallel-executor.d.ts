import type { EndpointTask } from "../types/endpoint.js";
import type { ControllerTask } from "../types/controller-group.js";
import { type FileWriterOptions } from "../nodes/file-writer.js";
import { type ModelConfig } from "../graph/model-factory.js";
export interface ExecutorConfig {
    concurrency: number;
    model: string;
    apiKey: string;
    fullPrismaSchema: string;
    writerOptions: FileWriterOptions;
}
export interface ExecutorResult {
    completed: EndpointTask[];
    failed: EndpointTask[];
    skipped: EndpointTask[];
    writtenFiles: string[];
    durationMs: number;
}
export interface ControllerExecutorConfig {
    concurrency: number;
    apiKey: string;
    fullPrismaSchema: string;
    writerOptions: FileWriterOptions;
    models?: Partial<ModelConfig>;
}
export interface ControllerExecutorResult {
    completed: ControllerTask[];
    failed: ControllerTask[];
    skipped: ControllerTask[];
    writtenFiles: string[];
    durationMs: number;
    controllerCount: number;
    endpointCount: number;
}
export declare function executeParallel(tasks: EndpointTask[], config: ExecutorConfig): Promise<ExecutorResult>;
export declare function executeControllerParallel(tasks: EndpointTask[], config: ControllerExecutorConfig): Promise<ControllerExecutorResult>;
