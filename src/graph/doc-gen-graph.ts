import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatGoogle } from "@langchain/google";
import type { EndpointTask, ParsedEndpoint, GeneratedDocs } from "../types/endpoint.js";
import { generateDtos } from "../nodes/dto-generator.js";
import { generateSwagger } from "../nodes/swagger-generator.js";
import { writeGeneratedDocs } from "../nodes/file-writer.js";

const DocGenState = Annotation.Root({
  projectRoot: Annotation<string>(),
  parsedEndpoints: Annotation<ParsedEndpoint[]>(),
  prismaSchema: Annotation<string>(),
  taskQueue: Annotation<EndpointTask[]>(),
  currentTaskIndex: Annotation<number>(),
  completedTasks: Annotation<EndpointTask[]>(),
  failedTasks: Annotation<EndpointTask[]>(),
  writeLog: Annotation<string[]>(),
});

export type DocGenStateType = typeof DocGenState.State;

function createModels(apiKey: string) {
  const strongModel = new ChatGoogle({
    model: "gemini-2.5-flash",
    apiKey,
    temperature: 0.1,
  });
  const fastModel = new ChatGoogle({
    model: "gemini-2.5-flash",
    apiKey,
    temperature: 0.2,
  });
  return { strongModel, fastModel };
}

export function buildDocGenGraph(apiKey: string) {
  const { strongModel, fastModel } = createModels(apiKey);

  async function processEndpointNode(state: DocGenStateType) {
    const idx = state.currentTaskIndex;
    const task = state.taskQueue[idx];

    if (!task || task.status !== "pending") {
      return {};
    }

    console.log(
      `\n[${idx + 1}/${state.taskQueue.length}] Processing: ${task.endpoint.httpMethod} ${task.endpoint.routePath}`
    );

    const updatedQueue = [...state.taskQueue];
    updatedQueue[idx] = { ...task, status: "in_progress" };

    try {
      // Step 1: Generate DTOs
      const { requestDtoCode, responseDtoCode } = await generateDtos(
        task.endpoint,
        state.prismaSchema,
        strongModel
      );

      // Step 2: Generate Swagger
      const { controllerDecorators } = await generateSwagger(
        task.endpoint,
        requestDtoCode,
        responseDtoCode,
        fastModel
      );

      const docs: GeneratedDocs = {
        requestDtoCode,
        responseDtoCode,
        controllerDecorators,
        outputPaths: {
          requestDto: null,
          responseDto: "",
          decorators: "",
        },
      };

      // Step 3: Write files
      const writtenFiles = writeGeneratedDocs(
        { ...task, status: "completed" },
        docs
      );

      console.log(`  Written: ${writtenFiles.length} files`);
      for (const f of writtenFiles) {
        console.log(`    ${f}`);
      }

      updatedQueue[idx] = { ...task, status: "completed", result: docs };

      return {
        taskQueue: updatedQueue,
        completedTasks: [...state.completedTasks, updatedQueue[idx]],
        writeLog: [...state.writeLog, ...writtenFiles],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED: ${error}`);

      updatedQueue[idx] = { ...task, status: "failed", error };

      return {
        taskQueue: updatedQueue,
        failedTasks: [...state.failedTasks, updatedQueue[idx]],
      };
    }
  }

  function loopRouter(state: DocGenStateType): string {
    const nextIdx = state.currentTaskIndex + 1;
    if (nextIdx < state.taskQueue.length) {
      return "process_endpoint";
    }
    return END;
  }

  function advanceIndexNode(state: DocGenStateType) {
    return { currentTaskIndex: state.currentTaskIndex + 1 };
  }

  const workflow = new StateGraph(DocGenState)
    .addNode("process_endpoint", processEndpointNode)
    .addNode("advance_index", advanceIndexNode)
    .addEdge(START, "process_endpoint")
    .addEdge("process_endpoint", "advance_index")
    .addConditionalEdges("advance_index", loopRouter, {
      process_endpoint: "process_endpoint",
      [END]: END,
    });

  return workflow.compile();
}
