import { ChatGoogle } from "@langchain/google";
export interface ModelConfig {
    analyzer: string;
    planner: string;
    writer: string;
}
declare const DEFAULT_MODELS: ModelConfig;
/**
 * Creates ChatGoogle instances for each agent role.
 * Models can be overridden via .documentator.json config.
 */
export declare function createModels(apiKey: string, overrides?: Partial<ModelConfig>): {
    analyzer: ChatGoogle;
    planner: ChatGoogle;
    writer: ChatGoogle;
};
export { DEFAULT_MODELS };
