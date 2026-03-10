import type { ParsedEndpoint } from "../types/endpoint.js";

export function buildDtoPrompt(
  endpoint: ParsedEndpoint,
  prismaSchema: string | null
): string {
  const needsRequestDto = !["GET", "DELETE"].includes(endpoint.httpMethod);

  const paramsSection = endpoint.params
    .map((p) => `  ${p.decorator}${p.name ? `('${p.name}')` : ""} ${p.typeName}${p.isOptional ? "?" : ""}`)
    .join("\n");

  const serviceSection = endpoint.tracedService
    ? `
## Service Method: ${endpoint.tracedService.serviceClassName}.${endpoint.tracedService.methodName}
Return type: ${endpoint.tracedService.returnTypeName}
Prisma models referenced: ${endpoint.tracedService.prismaModelsReferenced.join(", ") || "none"}

\`\`\`typescript
${endpoint.tracedService.sourceCode}
\`\`\``
    : `
## Service Method: Could not be resolved automatically
Reason: ${endpoint.traceFailureReason ?? "unknown"}

The controller method source code is provided below. Analyze it to understand:
- Which service method is being called
- What parameters are passed to it
- What it likely returns (use method name + Prisma schema for type inference)

\`\`\`typescript
${endpoint.controllerMethodCode}
\`\`\`

Based on this controller code and the Prisma schema below, infer the DTO fields.`;

  const prismaSection = prismaSchema
    ? `
## Prisma Schema
\`\`\`prisma
${prismaSchema}
\`\`\``
    : `
## Prisma Schema: NOT AVAILABLE
Use conservative types (string, number, boolean).`;

  return `You are a senior NestJS developer. Generate TypeScript DTO classes for the following endpoint.

## Endpoint
HTTP Method: ${endpoint.httpMethod}
Full Path: ${endpoint.routePath}
Controller: ${endpoint.controllerClass}
Method: ${endpoint.methodSignature}

## Parameters
${paramsSection || "  (none)"}
${serviceSection}
${prismaSection}

## Task
Generate ${needsRequestDto ? "both request and response" : "only response"} DTO class(es).

Rules:
- Use class-validator decorators: @IsString, @IsEmail, @IsNumber, @IsBoolean, @IsOptional, @IsArray, @ValidateNested, @IsEnum, @IsUUID, @IsDate, @Min, @Max, @MinLength, @MaxLength, @IsNotEmpty
- Use class-transformer decorators: @Expose() on every field, @Type(() => NestedDto) for nested objects, @Exclude() on sensitive fields
- Every class must have @Exclude() at class level for response DTOs (whitelist approach)
- Do NOT include sensitive fields in response DTOs: passwordHash, password, secret, token (unless it's an auth endpoint returning a token)
- Infer field names and types strictly from Prisma schema. If schema is unavailable, use method name + HTTP method semantics.
- If service uses Prisma include/select, reflect those relations in response DTO with nested DTOs
- All classes are export class (not interface)
- Include proper imports at the top of each file
- No placeholder comments like "// add fields here"
- For GET list endpoints, wrap in a paginated response if the service returns an array

Output ONLY valid JSON (no markdown fences):
{
  "requestDtoCode": ${needsRequestDto ? '"import { IsString } ... export class XxxRequestDto { ... }"' : "null"},
  "responseDtoCode": "import { Expose } ... export class XxxResponseDto { ... }"
}`;
}
