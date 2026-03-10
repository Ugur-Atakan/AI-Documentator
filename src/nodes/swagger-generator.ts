import { ChatGoogle } from "@langchain/google";
import type { ParsedEndpoint } from "../types/endpoint.js";
import { buildSwaggerPrompt } from "../prompts/swagger-prompt.js";
import { GeneratedSwaggerSchema } from "../schemas/endpoint-schema.js";

function normalizeCodeFence(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function generateSwagger(
  endpoint: ParsedEndpoint,
  requestDtoCode: string | null,
  responseDtoCode: string,
  model: ChatGoogle
): Promise<{ controllerDecorators: string }> {
  const prompt = buildSwaggerPrompt(endpoint, requestDtoCode, responseDtoCode);

  console.error(
    `  [Swagger] ${endpoint.httpMethod} ${endpoint.routePath}`
  );

  const response = await model.invoke(prompt);
  const raw = normalizeCodeFence(String(response.content));

  let parsed: { controllerDecorators: string };
  try {
    parsed = GeneratedSwaggerSchema.parse(JSON.parse(raw));
  } catch (err) {
    throw new Error(
      `Swagger generation failed for ${endpoint.methodName}: invalid JSON response. Raw: ${raw.slice(0, 200)}`
    );
  }

  return parsed;
}
