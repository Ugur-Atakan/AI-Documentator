import type { ChatGoogle } from "@langchain/google";
import type { DocumentationPlan, ConsolidatedOutput } from "../../types/controller-group.js";
/**
 * Agent 3: Code Writer
 *
 * Takes the Planner's JSON schema and generates actual TypeScript code.
 * Uses a fast model since generating code from a clear schema is straightforward.
 * Outputs 4 code sections: request DTOs, response DTOs, enums, decorators.
 */
export declare function writeControllerCode(plan: DocumentationPlan, moduleName: string, prismaSchema: string, model: ChatGoogle): Promise<ConsolidatedOutput>;
