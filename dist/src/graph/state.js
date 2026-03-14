/** Create initial state for a controller pipeline run */
export function createInitialState(group, prismaSchema, projectAnalysis) {
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
