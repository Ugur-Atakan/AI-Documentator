import type { ChatGoogle } from "@langchain/google";
import type { ControllerGroup, DocumentationPlan, ProjectAnalysis } from "../../types/controller-group.js";
/**
 * Agent 2: Planner
 *
 * Takes a controller's endpoints and produces a structured JSON plan
 * describing all DTOs, enums, and decorator metadata.
 * Uses the strongest model (Pro) for best reasoning about schemas.
 */
export declare function planController(group: ControllerGroup, prismaSchema: string, projectAnalysis: ProjectAnalysis | null, model: ChatGoogle): Promise<DocumentationPlan>;
