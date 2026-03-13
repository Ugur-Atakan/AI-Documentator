import pLimit from "p-limit";
import { ChatGoogle } from "@langchain/google";
import { generateDtos } from "../nodes/dto-generator.js";
import { generateSwagger } from "../nodes/swagger-generator.js";
import { writeGeneratedDocs, writeConsolidatedDocs } from "../nodes/file-writer.js";
import { parsePrismaSchema, getRelevantSchema, } from "../utils/prisma-filter.js";
import { Renderer } from "../cli/renderer.js";
import { saveFailedEndpoints } from "./retry-store.js";
import { createModels } from "../graph/model-factory.js";
import { runControllerPipeline } from "../graph/documentation-graph.js";
import { createInitialState } from "../graph/state.js";
import { analyzeProject, buildProjectSummary, } from "../graph/agents/project-analyzer.js";
import { groupByController } from "../utils/group-by-controller.js";
// ── Legacy pipeline (per-endpoint) ──────────────────────────────────────────
export async function executeParallel(tasks, config) {
    const limit = pLimit(config.concurrency);
    const modelMap = parsePrismaSchema(config.fullPrismaSchema);
    const strongModel = new ChatGoogle({
        model: config.model,
        apiKey: config.apiKey,
        temperature: 0.1,
    });
    const fastModel = new ChatGoogle({
        model: config.model,
        apiKey: config.apiKey,
        temperature: 0.2,
    });
    // ── Renderer setup ──────────────────────────────────────────────────────
    const renderer = new Renderer();
    const lines = tasks.map((t) => ({
        method: t.endpoint.httpMethod,
        path: t.endpoint.routePath,
        controller: t.endpoint.controllerClass,
        status: "pending",
    }));
    renderer.start(lines);
    // ── Results ─────────────────────────────────────────────────────────────
    const completed = [];
    const failed = [];
    const skipped = [];
    const writtenFiles = [];
    // ── Process single endpoint ─────────────────────────────────────────────
    async function processOne(task, index) {
        const ep = task.endpoint;
        try {
            // Phase 1: DTO
            renderer.update(index, "dto");
            const tracedModels = ep.tracedService?.prismaModelsReferenced ?? [];
            const relevantSchema = getRelevantSchema(tracedModels, ep.routePath, modelMap, config.fullPrismaSchema);
            const { requestDtoCode, responseDtoCode } = await generateDtos(ep, relevantSchema, strongModel);
            // Phase 2: Swagger
            renderer.update(index, "swagger");
            const { controllerDecorators } = await generateSwagger(ep, requestDtoCode, responseDtoCode, fastModel);
            // Phase 3: Write
            renderer.update(index, "writing");
            const docs = {
                requestDtoCode,
                responseDtoCode,
                controllerDecorators,
                outputPaths: { requestDto: null, responseDto: "", decorators: "" },
            };
            const files = writeGeneratedDocs({ ...task, status: "completed" }, docs, config.writerOptions);
            writtenFiles.push(...files);
            completed.push({ ...task, status: "completed", result: docs });
            renderer.update(index, "done");
        }
        catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            failed.push({ ...task, status: "failed", error });
            renderer.update(index, "failed", error);
        }
    }
    // ── Launch ──────────────────────────────────────────────────────────────
    const promises = tasks.map((task, i) => limit(() => processOne(task, i)));
    await Promise.allSettled(promises);
    renderer.stop();
    // Save failed endpoints for retry
    saveFailedEndpoints(failed);
    return {
        completed,
        failed,
        skipped,
        writtenFiles,
        durationMs: renderer.getStats().elapsed,
    };
}
// ── New pipeline (per-controller, multi-agent) ──────────────────────────────
export async function executeControllerParallel(tasks, config) {
    const limit = pLimit(config.concurrency);
    const models = createModels(config.apiKey, config.models);
    // Group endpoints by controller
    const endpoints = tasks.map((t) => t.endpoint);
    const groups = groupByController(endpoints);
    // ── Renderer setup ──────────────────────────────────────────────────────
    const renderer = new Renderer();
    const controllerLines = groups.map((g) => ({
        controllerClass: g.controllerClass,
        endpointCount: g.endpoints.length,
        status: "pending",
    }));
    renderer.startControllers(controllerLines);
    // ── Project Analysis (once, shared) ─────────────────────────────────────
    let projectAnalysis = null;
    try {
        const controllerClasses = groups.map((g) => g.controllerClass);
        const modulePaths = [...new Set(groups.map((g) => g.moduleName))];
        const summary = buildProjectSummary(controllerClasses, endpoints.length, !!config.fullPrismaSchema, modulePaths);
        projectAnalysis = await analyzeProject(summary, models.analyzer);
    }
    catch {
        // Non-critical — proceed without analysis
    }
    // ── Prisma schema ───────────────────────────────────────────────────────
    const modelMap = parsePrismaSchema(config.fullPrismaSchema);
    // ── Results ─────────────────────────────────────────────────────────────
    const completed = [];
    const failed = [];
    const skipped = [];
    const writtenFiles = [];
    // ── Process single controller ───────────────────────────────────────────
    async function processController(group, index) {
        try {
            // Get relevant Prisma schema for all endpoints in this controller
            const allModels = group.endpoints.flatMap((ep) => ep.tracedService?.prismaModelsReferenced ?? []);
            const allRoutes = group.endpoints.map((ep) => ep.routePath);
            const relevantSchema = getRelevantSchema([...new Set(allModels)], allRoutes.join(","), modelMap, config.fullPrismaSchema);
            const initialState = createInitialState(group, relevantSchema, projectAnalysis);
            // Run the multi-agent pipeline
            const onPhaseChange = (phase) => {
                const statusMap = {
                    planning: "planning",
                    generating: "generating",
                    reviewing: "reviewing",
                    writing: "writing",
                    completed: "done",
                    failed: "failed",
                };
                renderer.updateController(index, statusMap[phase] ?? "generating");
            };
            renderer.updateController(index, "planning");
            const result = await runControllerPipeline(initialState, {
                plannerModel: models.planner,
                writerModel: models.writer,
                prismaSchema: relevantSchema,
            });
            if (result.currentPhase === "failed") {
                failed.push({
                    group,
                    status: "failed",
                    error: result.error ?? "Unknown error",
                });
                renderer.updateController(index, "failed", result.error ?? undefined);
                return;
            }
            // Write files
            renderer.updateController(index, "writing");
            if (result.generatedCode) {
                const files = writeConsolidatedDocs(group, result.generatedCode, config.writerOptions);
                writtenFiles.push(...files);
            }
            completed.push({
                group,
                status: "completed",
                result: result.generatedCode ?? undefined,
            });
            renderer.updateController(index, "done");
        }
        catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            failed.push({ group, status: "failed", error });
            renderer.updateController(index, "failed", error);
        }
    }
    // ── Launch ──────────────────────────────────────────────────────────────
    const promises = groups.map((group, i) => limit(() => processController(group, i)));
    await Promise.allSettled(promises);
    renderer.stop();
    // Build failed endpoint tasks for retry store
    const failedEndpointTasks = failed.flatMap((f) => f.group.endpoints.map((ep) => ({
        endpoint: ep,
        status: "failed",
        error: f.error,
    })));
    saveFailedEndpoints(failedEndpointTasks);
    return {
        completed,
        failed,
        skipped,
        writtenFiles,
        durationMs: renderer.getStats().elapsed,
        controllerCount: groups.length,
        endpointCount: endpoints.length,
    };
}
