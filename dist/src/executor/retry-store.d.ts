import type { EndpointTask } from "../types/endpoint.js";
/** Save failed endpoint IDs after a run */
export declare function saveFailedEndpoints(failed: EndpointTask[]): void;
/** Load failed endpoint IDs from previous run */
export declare function loadFailedEndpointIds(): string[] | null;
/** Filter task queue to only include previously failed endpoints */
export declare function filterToFailed(taskQueue: EndpointTask[], failedIds: string[]): EndpointTask[];
export declare function hasRetryFile(): boolean;
export declare function getFailedCount(): number;
