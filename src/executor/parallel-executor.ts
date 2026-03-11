import pLimit from "p-limit";
import { ChatGoogle } from "@langchain/google";
import type { EndpointTask, GeneratedDocs } from "../types/endpoint.js";
import { generateDtos } from "../nodes/dto-generator.js";
import { generateSwagger } from "../nodes/swagger-generator.js";
import { writeGeneratedDocs, type FileWriterOptions } from "../nodes/file-writer.js";
import {
  parsePrismaSchema,
  getRelevantSchema,
  type PrismaModelMap,
} from "../utils/prisma-filter.js";
import { Renderer, type EndpointLine } from "../cli/renderer.js";
import { saveFailedEndpoints } from "./retry-store.js";

export interface ExecutorConfig {
  concurrency: number;
  model: string;
  apiKey: string;
  fullPrismaSchema: string;
  writerOptions: FileWriterOptions;
}

export interface ExecutorResult {
  completed: EndpointTask[];
  failed: EndpointTask[];
  skipped: EndpointTask[];
  writtenFiles: string[];
  durationMs: number;
}

export async function executeParallel(
  tasks: EndpointTask[],
  config: ExecutorConfig
): Promise<ExecutorResult> {
  const limit = pLimit(config.concurrency);
  const modelMap: PrismaModelMap = parsePrismaSchema(config.fullPrismaSchema);

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
  const lines: EndpointLine[] = tasks.map((t) => ({
    method: t.endpoint.httpMethod,
    path: t.endpoint.routePath,
    controller: t.endpoint.controllerClass,
    status: "pending" as const,
  }));
  renderer.start(lines);

  // ── Results ─────────────────────────────────────────────────────────────
  const completed: EndpointTask[] = [];
  const failed: EndpointTask[] = [];
  const skipped: EndpointTask[] = [];
  const writtenFiles: string[] = [];

  // ── Process single endpoint ─────────────────────────────────────────────
  async function processOne(task: EndpointTask, index: number): Promise<void> {
    const ep = task.endpoint;

    try {
      // Phase 1: DTO
      renderer.update(index, "dto");
      const tracedModels = ep.tracedService?.prismaModelsReferenced ?? [];
      const relevantSchema = getRelevantSchema(
        tracedModels,
        ep.routePath,
        modelMap,
        config.fullPrismaSchema
      );

      const { requestDtoCode, responseDtoCode } = await generateDtos(
        ep,
        relevantSchema,
        strongModel
      );

      // Phase 2: Swagger
      renderer.update(index, "swagger");
      const { controllerDecorators } = await generateSwagger(
        ep,
        requestDtoCode,
        responseDtoCode,
        fastModel
      );

      // Phase 3: Write
      renderer.update(index, "writing");
      const docs: GeneratedDocs = {
        requestDtoCode,
        responseDtoCode,
        controllerDecorators,
        outputPaths: { requestDto: null, responseDto: "", decorators: "" },
      };

      const files = writeGeneratedDocs(
        { ...task, status: "completed" },
        docs,
        config.writerOptions
      );

      writtenFiles.push(...files);
      completed.push({ ...task, status: "completed", result: docs });
      renderer.update(index, "done");
    } catch (err) {
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
