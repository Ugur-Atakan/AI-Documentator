export type EndpointStatus = "pending" | "dto" | "swagger" | "writing" | "done" | "failed" | "skipped";
export interface EndpointLine {
    method: string;
    path: string;
    controller: string;
    status: EndpointStatus;
    error?: string;
}
export type ControllerStatus = "pending" | "analyzing" | "planning" | "generating" | "reviewing" | "writing" | "done" | "failed" | "skipped";
export interface ControllerLine {
    controllerClass: string;
    endpointCount: number;
    status: ControllerStatus;
    error?: string;
}
/**
 * Fixed-height terminal renderer using log-update.
 * Supports both legacy endpoint-based and new controller-based modes.
 */
export declare class Renderer {
    private endpoints;
    private controllers;
    private mode;
    private interval;
    private startTime;
    /** Total lines the render block occupies — never changes mid-run */
    private readonly VISIBLE_LINES;
    start(endpoints: EndpointLine[]): void;
    update(index: number, status: EndpointStatus, error?: string): void;
    startControllers(controllers: ControllerLine[]): void;
    updateController(index: number, status: ControllerStatus, error?: string): void;
    private render;
    private renderEndpoints;
    private renderControllers;
    stop(): void;
    getStats(): {
        done: number;
        failed: number;
        skipped: number;
        elapsed: number;
    };
    getFailedEndpoints(): EndpointLine[];
    getFailedControllers(): ControllerLine[];
}
