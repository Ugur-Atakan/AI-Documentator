import type { ControllerGroup } from "../types/controller-group.js";
/**
 * Builds the Planner agent prompt.
 * Takes ALL endpoints for a controller and produces a structured JSON plan.
 * The plan describes DTO schemas, shared enums, and decorator metadata
 * WITHOUT generating actual code — that's the Writer's job.
 */
export declare function buildPlannerPrompt(group: ControllerGroup, prismaSchema: string | null, projectAnalysis: string | null): string;
