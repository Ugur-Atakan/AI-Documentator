import type {
  ControllerGroup,
  ConsolidatedOutput,
  DocumentationPlan,
  ProjectAnalysis,
  ReviewResult,
} from "../types/controller-group.js";

/** LangGraph state for the per-controller documentation pipeline */
export interface DocumentatorState {
  // Input
  controllerGroup: ControllerGroup;
  prismaSchema: string;
  projectAnalysis: ProjectAnalysis | null;

  // Agent 2 output (Planner)
  documentationPlan: DocumentationPlan | null;

  // Agent 3 output (Writer)
  generatedCode: ConsolidatedOutput | null;

  // Agent 4 output (Reviewer — rule-based)
  reviewResult: ReviewResult | null;

  // Control
  currentPhase: string;
  error: string | null;
  retryCount: number;
}

/** Create initial state for a controller pipeline run */
export function createInitialState(
  group: ControllerGroup,
  prismaSchema: string,
  projectAnalysis: ProjectAnalysis | null
): DocumentatorState {
  return {
    controllerGroup: group,
    prismaSchema,
    projectAnalysis,

    documentationPlan: null,
    generatedCode: null,
    reviewResult: null,

    currentPhase: "pending",
    error: null,
    retryCount: 0,
  };
}
