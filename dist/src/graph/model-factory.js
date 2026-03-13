import { ChatGoogle } from "@langchain/google";
const DEFAULT_MODELS = {
    analyzer: "gemini-2.5-flash",
    planner: "gemini-2.5-pro",
    writer: "gemini-2.5-flash",
};
/**
 * Creates ChatGoogle instances for each agent role.
 * Models can be overridden via .documentator.json config.
 */
export function createModels(apiKey, overrides) {
    const config = { ...DEFAULT_MODELS, ...overrides };
    return {
        analyzer: new ChatGoogle({
            model: config.analyzer,
            apiKey,
            temperature: 0.1,
        }),
        planner: new ChatGoogle({
            model: config.planner,
            apiKey,
            temperature: 0.1,
        }),
        writer: new ChatGoogle({
            model: config.writer,
            apiKey,
            temperature: 0.2,
        }),
    };
}
export { DEFAULT_MODELS };
