import type { EndpointTask, ParserOutput } from "../types/endpoint.js";
export interface TaskLoaderInput {
    parsedOutputPath: string;
}
export interface TaskLoaderOutput {
    parsedEndpoints: ParserOutput["endpoints"];
    prismaSchema: string;
    taskQueue: EndpointTask[];
}
export declare function loadTasks(parsedOutputPath: string): TaskLoaderOutput;
