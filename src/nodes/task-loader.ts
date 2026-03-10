import * as fs from "fs";
import type { EndpointTask, ParserOutput } from "../types/endpoint.js";
import { ParserOutputSchema } from "../schemas/endpoint-schema.js";

export interface TaskLoaderInput {
  parsedOutputPath: string;
}

export interface TaskLoaderOutput {
  parsedEndpoints: ParserOutput["endpoints"];
  prismaSchema: string;
  taskQueue: EndpointTask[];
}

export function loadTasks(parsedOutputPath: string): TaskLoaderOutput {
  if (!fs.existsSync(parsedOutputPath)) {
    throw new Error(`Parsed output not found: ${parsedOutputPath}`);
  }

  const raw = fs.readFileSync(parsedOutputPath, "utf-8");
  const json = JSON.parse(raw);
  const validated = ParserOutputSchema.parse(json);

  const taskQueue: EndpointTask[] = validated.endpoints.map((endpoint) => ({
    endpoint,
    status: "pending",
  }));

  return {
    parsedEndpoints: validated.endpoints,
    prismaSchema: validated.prismaSchemaContent ?? "",
    taskQueue,
  };
}
