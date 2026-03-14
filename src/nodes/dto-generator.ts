import { ChatGoogle } from "@langchain/google";
import type { ParsedEndpoint } from "../types/endpoint.js";
import { buildDtoPrompt } from "../prompts/dto-prompt.js";
import { parseDtoResponse } from "../utils/response-parser.js";
import { withRetry } from "../utils/retry.js";

export async function generateDtos(
  endpoint: ParsedEndpoint,
  prismaSchema: string,
  model: ChatGoogle
): Promise<{ requestDtoCode: string | null; responseDtoCode: string }> {
  const prompt = buildDtoPrompt(endpoint, prismaSchema || null);

  return withRetry(
    `DTO ${endpoint.httpMethod} ${endpoint.routePath}`,
    async () => {
      const response = await model.invoke(prompt);
      const raw = String(response.content);

      try {
        return parseDtoResponse(raw);
      } catch {
        throw new Error(
          `Could not extract DTO from response for ${endpoint.methodName}. First 150 chars: ${raw.slice(0, 150)}`
        );
      }
    }
  );
}
