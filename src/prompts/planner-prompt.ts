import type { ControllerGroup } from "../types/controller-group.js";

/**
 * Builds the Planner agent prompt.
 * Takes ALL endpoints for a controller and produces a structured JSON plan.
 * The plan describes DTO schemas, shared enums, and decorator metadata
 * WITHOUT generating actual code — that's the Writer's job.
 */
export function buildPlannerPrompt(
  group: ControllerGroup,
  prismaSchema: string | null,
  projectAnalysis: string | null
): string {
  const endpointSections = group.endpoints
    .map((ep) => {
      const paramsStr = ep.params
        .map(
          (p) =>
            `    ${p.decorator}${p.name ? `('${p.name}')` : ""} ${p.typeName}${p.isOptional ? "?" : ""}`
        )
        .join("\n");

      const authLines: string[] = [];
      if (ep.authContext.isPublic) {
        authLines.push("PUBLIC");
      } else {
        authLines.push("JWT required");
      }
      if (ep.authContext.requiresContext) {
        authLines.push("@Context() — workspaceId/mailboxId from JWT");
      }
      if (ep.authContext.currentUserUsages.length > 0) {
        authLines.push(`@CurrentUser(${ep.authContext.currentUserUsages.join(", ")})`);
      }
      if (ep.authContext.requiredPermission) {
        authLines.push(
          `CASL: ${ep.authContext.requiredPermission.action} on ${ep.authContext.requiredPermission.subject}`
        );
      }

      const serviceCode = ep.tracedService
        ? `Service: ${ep.tracedService.serviceClassName}.${ep.tracedService.methodName}
    Return type: ${ep.tracedService.returnTypeName}
    Prisma models: ${ep.tracedService.prismaModelsReferenced.join(", ") || "none"}
    \`\`\`typescript
    ${ep.tracedService.sourceCode}
    \`\`\``
        : `Service not traced. Controller code:
    \`\`\`typescript
    ${ep.controllerMethodCode}
    \`\`\``;

      return `### ${ep.httpMethod} ${ep.routePath} — ${ep.methodName}
  Signature: ${ep.methodSignature}
  Auth: ${authLines.join(", ")}
  Parameters:
${paramsStr || "    (none)"}
  ${serviceCode}`;
    })
    .join("\n\n");

  const prismaSection = prismaSchema
    ? `## Prisma Schema (relevant models)
\`\`\`prisma
${prismaSchema}
\`\`\``
    : "## Prisma Schema: NOT AVAILABLE — use conservative types.";

  const analysisSection = projectAnalysis
    ? `## Project Analysis
${projectAnalysis}`
    : "";

  return `You are a senior NestJS architect. Analyze the following controller and create a DOCUMENTATION PLAN.

DO NOT generate code. Output a structured JSON plan that describes:
1. What DTO classes are needed for each endpoint
2. What fields each DTO should have (with types, validators, descriptions)
3. Which enums are shared across endpoints
4. What Swagger decorators each endpoint needs

## Controller: ${group.controllerClass}
Module: ${group.moduleName}
File: ${group.controllerFilePath}
Endpoints: ${group.endpoints.length}

${analysisSection}

## Endpoints

${endpointSections}

${prismaSection}

## Planning Rules

1. **Shared enums**: If multiple endpoints use the same enum, define it once in sharedEnums
2. **DTO naming**: Create{Resource}Dto, Update{Resource}Dto, {Resource}ResponseDto, {Resource}QueryDto
3. **Update DTOs**: Use PartialType(Create...Dto) pattern — note this in extendsClass
4. **Field inference**: Use Prisma schema + service code to determine exact fields
5. **Auth fields**: NEVER include workspaceId/mailboxId/userId if they come from @Context()/@CurrentUser()
6. **Pagination**: GET list endpoints should have a QueryDto with page/limit/search
7. **ApiProperty**: Every field MUST have a description and example value
8. **Validators**: Match Prisma types: UUID → @IsUUID(), String → @IsString(), Int → @IsInt(), etc.
9. **Response structure**: If service returns array/paginated, reflect that in response DTO

## Output Format

Output ONLY the JSON between these exact delimiters:

===DOCUMENTATION_PLAN===
{
  "controllerClass": "${group.controllerClass}",
  "sharedEnums": [
    {
      "name": "EnumName",
      "values": ["VALUE1", "VALUE2"],
      "description": "Description of the enum"
    }
  ],
  "endpoints": [
    {
      "methodName": "methodName",
      "httpMethod": "POST",
      "routePath": "/path",
      "requestDto": {
        "className": "CreateSomethingDto",
        "fields": [
          {
            "name": "fieldName",
            "type": "string",
            "isOptional": false,
            "isArray": false,
            "validators": ["IsString", "IsNotEmpty"],
            "description": "Human readable description",
            "example": "example value"
          }
        ]
      },
      "responseDto": {
        "className": "SomethingResponseDto",
        "fields": [...]
      },
      "decorators": {
        "summary": "Create a new something",
        "description": "Requires CASL permission: create on Something",
        "responses": [
          { "status": 201, "description": "Created successfully", "type": "SomethingResponseDto" },
          { "status": 400, "description": "Validation failed" },
          { "status": 401, "description": "Unauthorized" }
        ],
        "params": [
          { "name": "id", "type": "string", "required": true, "description": "Resource ID (UUID)" }
        ],
        "queries": [],
        "needsBearerAuth": true,
        "needsApiBody": true
      }
    }
  ]
}
===END_DOCUMENTATION_PLAN===

IMPORTANT: Output valid JSON only. No comments, no trailing commas. No markdown fences inside the delimiters.`;
}
