import type { ParsedEndpoint } from "../types/endpoint.js";

/**
 * Builds the Swagger decorator generation prompt for vmh-server-v2.
 *
 * Key rules:
 * - Never add @ApiBearerAuth() if it's already on the class level
 * - Never add @ApiTags() — always on the class level
 * - Never add @ApiOperation() if it already exists on the method
 * - Public endpoints must NOT have @ApiBearerAuth()
 * - CASL permission context goes into @ApiOperation description
 * - Include appropriate 401/403/404 error responses based on guards
 */
export function buildSwaggerPrompt(
  endpoint: ParsedEndpoint,
  requestDtoCode: string | null,
  responseDtoCode: string
): string {
  const paramsSection = endpoint.params
    .map(
      (p) =>
        `  ${p.decorator}${p.name ? `('${p.name}')` : ""} ${p.typeName}${p.isOptional ? "?" : ""}`
    )
    .join("\n");

  const hasBody = endpoint.params.some((p) => p.decorator === "@Body");
  const pathParams = endpoint.params.filter((p) => p.decorator === "@Param");
  const queryParams = endpoint.params.filter((p) => p.decorator === "@Query");

  const requestDtoName = requestDtoCode
    ? requestDtoCode.match(/export class (\w+)/)?.[1] ?? null
    : null;
  const responseDtoName =
    responseDtoCode.match(/export class (\w+)/)?.[1] ?? "ResponseDto";

  const successStatus = endpoint.httpMethod === "POST" ? 201 : 200;

  // ── Auth context ──────────────────────────────────────────────────────────
  const { authContext, existingSwagger } = endpoint;
  const authNotes: string[] = [];

  if (authContext.isPublic) {
    authNotes.push("PUBLIC endpoint — do NOT add @ApiBearerAuth().");
  } else if (existingSwagger.hasBearerAuthOnClass) {
    authNotes.push(
      "@ApiBearerAuth() is already on the controller class — do NOT add it again on the method."
    );
  } else {
    authNotes.push(
      "Endpoint requires authentication. Add @ApiBearerAuth() on this method."
    );
  }

  if (authContext.requiresContext) {
    authNotes.push(
      "Uses @Context() — user must have an active workspace/mailbox context set."
    );
  }

  if (authContext.requiredPermission) {
    const { action, subject } = authContext.requiredPermission;
    authNotes.push(
      `CASL permission required: ${action} on ${subject}. Include this in @ApiOperation description.`
    );
  }

  if (authContext.requiredRoles?.length) {
    authNotes.push(
      `Required roles: ${authContext.requiredRoles.join(", ")}. Mention in @ApiOperation description.`
    );
  }

  const hasCaslGuard = authContext.guards.some(
    (g) => g.includes("PoliciesGuard") || g.includes("WorkspacePoliciesGuard")
  );

  // ── Existing swagger state ────────────────────────────────────────────────
  const existingNotes: string[] = [];
  if (existingSwagger.hasApiOperation) {
    existingNotes.push("@ApiOperation already exists on this method — SKIP IT.");
  }
  if (existingSwagger.hasApiResponse) {
    existingNotes.push(
      "@ApiResponse already exists on this method — only add responses that are MISSING."
    );
  }
  if (existingSwagger.hasApiBody) {
    existingNotes.push("@ApiBody already exists on this method — SKIP IT.");
  }
  if (existingSwagger.hasApiTags) {
    existingNotes.push(
      `@ApiTags(${existingSwagger.apiTags.map((t) => `'${t}'`).join(", ")}) already on class — do NOT add @ApiTags() on the method.`
    );
  }

  // ── Determine which error responses to include ────────────────────────────
  const errorResponses: string[] = [];

  if (!authContext.isPublic) {
    errorResponses.push(
      "401 — Unauthorized (missing or invalid Bearer token)"
    );
  }
  if (hasCaslGuard || authContext.requiredPermission || authContext.requiredRoles?.length) {
    errorResponses.push(
      "403 — Forbidden (insufficient permissions or missing workspace context)"
    );
  }
  if (pathParams.length > 0) {
    errorResponses.push("404 — Not Found (resource with given ID does not exist)");
  }
  if (["POST", "PUT", "PATCH"].includes(endpoint.httpMethod)) {
    errorResponses.push("400 — Bad Request (validation failed)");
    errorResponses.push("422 — Unprocessable Entity (business rule violation)");
  }

  return `You are a senior NestJS developer. Generate Swagger (OpenAPI) decorator annotations for the following endpoint.
The project uses @nestjs/swagger v11.

## Endpoint
HTTP Method: ${endpoint.httpMethod}
Full Path:   ${endpoint.routePath}
Controller:  ${endpoint.controllerClass}
Method:      ${endpoint.methodSignature}

## Controller Parameters
${paramsSection || "  (none)"}

## Auth & Authorization Notes
${authNotes.map((n) => `- ${n}`).join("\n")}

## Existing Swagger State (do NOT duplicate these)
${existingNotes.length > 0 ? existingNotes.map((n) => `- ${n}`).join("\n") : "- No existing Swagger decorators on this method."}

## Generated DTOs
${
  requestDtoCode
    ? `Request DTO: ${requestDtoName}\n\`\`\`typescript\n${requestDtoCode}\n\`\`\``
    : "No request DTO (GET or DELETE endpoint)"
}

Response DTO: ${responseDtoName}
\`\`\`typescript
${responseDtoCode}
\`\`\`

## Error Responses to Include
${errorResponses.map((e) => `- ${e}`).join("\n")}

## Rules
- @ApiOperation: summary must be a clear human-readable sentence. If CASL permission or roles are required, mention them in the \`description\` field (not summary).
- @ApiBody: only if there is a request DTO AND it's not already on the method${hasBody && requestDtoName ? ` — use type: ${requestDtoName}` : " — skip"}
- @ApiResponse for success: status ${successStatus}, type: ${responseDtoName}
- @ApiResponse for each error listed above
${pathParams.length > 0 ? `- @ApiParam for each path param: ${pathParams.map((p) => p.name).join(", ")}` : ""}
${queryParams.length > 0 ? `- @ApiQuery for each query param: ${queryParams.map((p) => p.name).join(", ")} — mark optional ones with required: false` : ""}
- Output ONLY the decorator lines — NO import statements, NO class/method/function code
- Each decorator on its own line, properly formatted
- Use single quotes for strings inside decorators

## Output format
Use these EXACT delimiters (no JSON, no markdown fences).
IMPORTANT: Do NOT prefix decorators with @. These will be used inside applyDecorators() where @ is invalid syntax. Write them as plain function calls.

===SWAGGER_DECORATORS===
ApiOperation({ summary: '...' })
ApiResponse({ status: ${successStatus}, type: ${responseDtoName} })
...each decorator on its own line, NO @ prefix...
===END_SWAGGER_DECORATORS===

IMPORTANT: Write the raw decorator FUNCTION CALLS between the delimiters. No @ prefix. No JSON wrapping. No markdown fences. No import statements.`;
}
