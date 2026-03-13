import type { DocumentationPlan } from "../types/controller-group.js";
/**
 * Builds the Code Writer agent prompt.
 * Takes a structured JSON plan from the Planner and generates actual TypeScript code
 * for all DTOs, enums, and decorators in a single controller.
 */
export declare function buildWriterPrompt(plan: DocumentationPlan, prismaSchema: string | null): string;
