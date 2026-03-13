import type { ChatGoogle } from "@langchain/google";
import type { ProjectAnalysis } from "../../types/controller-group.js";
/**
 * Agent 1: Project Analyzer
 *
 * Analyzes the overall project structure and conventions.
 * Runs ONCE per execution, result is shared across all controllers.
 * Uses a lightweight model since the task is simple analysis.
 */
export declare function analyzeProject(projectSummary: string, model: ChatGoogle): Promise<ProjectAnalysis>;
/**
 * Build a lightweight project summary from parsed endpoints.
 * This avoids sending the full codebase to the analyzer.
 */
export declare function buildProjectSummary(controllerClasses: string[], sampleEndpointCount: number, hasPrisma: boolean, modulePaths: string[]): string;
