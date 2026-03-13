import { planController } from "./agents/planner-agent.js";
import { writeControllerCode } from "./agents/code-writer-agent.js";
import { reviewGeneratedCode } from "./agents/reviewer-agent.js";
const MAX_RETRY = 1;
/**
 * Creates a LangGraph pipeline for documenting a single controller.
 *
 * Flow: planner → writer → reviewer → (pass? → done, fail? → retry writer once)
 *
 * Note: LangGraph's StateGraph manages state transitions. We use a simplified
 * functional approach where each node returns partial state updates.
 */
export async function runControllerPipeline(state, config) {
    let current = { ...state };
    // Phase 1: Planning
    try {
        current = { ...current, currentPhase: "planning" };
        const plan = await planController(current.controllerGroup, config.prismaSchema, current.projectAnalysis, config.plannerModel);
        current = { ...current, documentationPlan: plan };
    }
    catch (err) {
        return {
            ...current,
            currentPhase: "failed",
            error: `Planning failed: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
    // Phase 2: Code Generation
    try {
        current = { ...current, currentPhase: "generating" };
        const code = await writeControllerCode(current.documentationPlan, current.controllerGroup.moduleName, config.prismaSchema, config.writerModel);
        current = { ...current, generatedCode: code };
    }
    catch (err) {
        return {
            ...current,
            currentPhase: "failed",
            error: `Code generation failed: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
    // Phase 3: Review (rule-based, no LLM)
    current = { ...current, currentPhase: "reviewing" };
    const reviewResult = reviewGeneratedCode(current.generatedCode);
    current = { ...current, reviewResult };
    if (!reviewResult.passed && current.retryCount < MAX_RETRY) {
        // Retry: re-run writer with feedback
        try {
            current = {
                ...current,
                retryCount: current.retryCount + 1,
                currentPhase: "generating",
            };
            const retryCode = await writeControllerCode(current.documentationPlan, current.controllerGroup.moduleName, config.prismaSchema, config.writerModel);
            current = { ...current, generatedCode: retryCode };
            // Re-review
            const retryReview = reviewGeneratedCode(retryCode);
            current = { ...current, reviewResult: retryReview };
            if (!retryReview.passed) {
                const errorIssues = retryReview.issues
                    .filter((i) => i.severity === "error")
                    .map((i) => i.message)
                    .join("; ");
                return {
                    ...current,
                    currentPhase: "failed",
                    error: `Review failed after retry: ${errorIssues}`,
                };
            }
        }
        catch (err) {
            return {
                ...current,
                currentPhase: "failed",
                error: `Retry failed: ${err instanceof Error ? err.message : String(err)}`,
            };
        }
    }
    else if (!reviewResult.passed) {
        const errorIssues = reviewResult.issues
            .filter((i) => i.severity === "error")
            .map((i) => i.message)
            .join("; ");
        return {
            ...current,
            currentPhase: "failed",
            error: `Review failed: ${errorIssues}`,
        };
    }
    return {
        ...current,
        currentPhase: "completed",
    };
}
