import { ChatGoogle } from "@langchain/google";
import type { ParsedEndpoint } from "../types/endpoint.js";
import { buildDtoPrompt } from "../prompts/dto-prompt.js";
import { GeneratedDtosSchema } from "../schemas/endpoint-schema.js";

function normalizeCodeFence(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

export async function generateDtos(
  endpoint: ParsedEndpoint,
  prismaSchema: string,
  model: ChatGoogle
): Promise<{ requestDtoCode: string | null; responseDtoCode: string }> {
  const prompt = buildDtoPrompt(endpoint, prismaSchema || null);

  console.error(
    `  [DTO] ${endpoint.httpMethod} ${endpoint.routePath}`
  );

  const response = await model.invoke(prompt);
  const raw = normalizeCodeFence(String(response.content));

  let parsed: { requestDtoCode: string | null; responseDtoCode: string };
  try {
    parsed = GeneratedDtosSchema.parse(JSON.parse(raw));
  } catch (err) {
    throw new Error(
      `DTO generation failed for ${endpoint.methodName}: invalid JSON response. Raw: ${raw.slice(0, 200)}`
    );
  }

  return parsed;
}
