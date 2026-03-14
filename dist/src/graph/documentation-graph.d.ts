import type { ChatGoogle } from "@langchain/google";
import type { DocumentatorState } from "./state.js";
interface GraphConfig {
    plannerModel: ChatGoogle;
    writerModel: ChatGoogle;
    prismaSchema: string;
}
/**
 * Creates a LangGraph pipeline for documenting a single controller.
 *
 * Flow: planner → writer → reviewer → (pass? → done, fail? → retry writer once)
 *
 * Note: LangGraph's StateGraph manages state transitions. We use a simplified
 * functional approach where each node returns partial state updates.
 */
export declare function runControllerPipeline(state: DocumentatorState, config: GraphConfig): Promise<DocumentatorState>;
export {};
