import type { ControllerGroup, ConsolidatedOutput, DocumentationPlan, ProjectAnalysis, ReviewResult } from "../types/controller-group.js";
/** LangGraph state for the per-controller documentation pipeline */
export interface DocumentatorState {
    controllerGroup: ControllerGroup;
    prismaSchema: string;
    projectAnalysis: ProjectAnalysis | null;
    documentationPlan: DocumentationPlan | null;
    generatedCode: ConsolidatedOutput | null;
    reviewResult: ReviewResult | null;
    currentPhase: string;
    error: string | null;
    retryCount: number;
}
/** Create initial state for a controller pipeline run */
export declare function createInitialState(group: ControllerGroup, prismaSchema: string, projectAnalysis: ProjectAnalysis | null): DocumentatorState;
