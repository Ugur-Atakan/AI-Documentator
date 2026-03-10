import type { ParsedEndpoint } from "../types/endpoint.js";

export function buildSwaggerPrompt(
  endpoint: ParsedEndpoint,
  requestDtoCode: string | null,
  responseDtoCode: string
): string {
  const paramsSection = endpoint.params
    .map((p) => `  ${p.decorator}${p.name ? `('${p.name}')` : ""} ${p.typeName}${p.isOptional ? "?" : ""}`)
    .join("\n");

  const hasBody = endpoint.params.some((p) => p.decorator === "@Body");
  const pathParams = endpoint.params.filter((p) => p.decorator === "@Param");
  const queryParams = endpoint.params.filter((p) => p.decorator === "@Query");

  const requestDtoName = requestDtoCode
    ? requestDtoCode.match(/export class (\w+)/)?.[1] ?? null
    : null;
  const responseDtoName = responseDtoCode.match(/export class (\w+)/)?.[1] ?? "ResponseDto";

  const successStatus =
    endpoint.httpMethod === "POST" ? 201 : 200;

  return `You are a senior NestJS developer. Generate Swagger (OpenAPI) decorator annotations for the following endpoint.

## Endpoint
HTTP Method: ${endpoint.httpMethod}
Full Path: ${endpoint.routePath}
Controller: ${endpoint.controllerClass}
Method: ${endpoint.methodSignature}

## Parameters
${paramsSection || "  (none)"}

## Generated DTOs
${requestDtoCode ? `Request DTO class: ${requestDtoName}\n\`\`\`typescript\n${requestDtoCode}\n\`\`\`` : "No request DTO (GET/DELETE endpoint)"}

Response DTO class: ${responseDtoName}
\`\`\`typescript
${responseDtoCode}
\`\`\`

## Task
Generate the Swagger decorator block for this controller method.

Rules:
- @ApiOperation: summary must be a clear, human-readable sentence (not just method name)
- @ApiBody: only if there is a request DTO${hasBody && requestDtoName ? ` — type: ${requestDtoName}` : " — skip for this endpoint"}
- @ApiResponse for success (status ${successStatus}, type: ${responseDtoName})
- @ApiResponse for likely errors:
  ${endpoint.params.some((p) => p.decorator === "@Param") ? "- 404 Not Found" : ""}
  ${["POST", "PUT", "PATCH"].includes(endpoint.httpMethod) ? "- 400 Bad Request (validation error)" : ""}
  - 401 Unauthorized (if auth is involved)
${pathParams.length > 0 ? `- @ApiParam for: ${pathParams.map((p) => p.name).join(", ")}` : ""}
${queryParams.length > 0 ? `- @ApiQuery for: ${queryParams.map((p) => p.name).join(", ")}` : ""}
- Output ONLY the decorator lines — NO import statements, NO class/method code
- Each decorator on its own line

Output ONLY valid JSON (no markdown fences):
{
  "controllerDecorators": "@ApiOperation({ summary: '...' })\\n@ApiResponse({ status: ${successStatus}, type: ${responseDtoName} })\\n..."
}`;
}
