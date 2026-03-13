import { buildSwaggerPrompt } from "../prompts/swagger-prompt.js";
import { parseSwaggerResponse } from "../utils/response-parser.js";
import { withRetry } from "../utils/retry.js";
export async function generateSwagger(endpoint, requestDtoCode, responseDtoCode, model) {
    const prompt = buildSwaggerPrompt(endpoint, requestDtoCode, responseDtoCode);
    return withRetry(`Swagger ${endpoint.httpMethod} ${endpoint.routePath}`, async () => {
        const response = await model.invoke(prompt);
        const raw = String(response.content);
        try {
            return parseSwaggerResponse(raw);
        }
        catch {
            throw new Error(`Could not extract Swagger from response for ${endpoint.methodName}. First 150 chars: ${raw.slice(0, 150)}`);
        }
    });
}
