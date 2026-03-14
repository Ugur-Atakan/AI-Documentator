/**
 * Builds the DTO generation prompt tailored for vmh-server-v2 conventions.
 *
 * Key conventions from vmh-server-v2:
 * - All DTOs live in a central /src/dtos/ directory
 * - Uses class-validator + class-transformer
 * - Shared response wrappers: PaginatedResponseDto<T>, ApiResponseDto<T>
 * - UUIDs always validated with @IsUUID()
 * - Auth context from @CurrentUser / @Context is NEVER put in the DTO body
 * - CASL permission hints guide field visibility
 */
export function buildDtoPrompt(endpoint, prismaSchema) {
    const needsRequestDto = !["GET", "DELETE"].includes(endpoint.httpMethod);
    // ── Auth context description ──────────────────────────────────────────────
    const authLines = [];
    if (endpoint.authContext.isPublic) {
        authLines.push("This endpoint is PUBLIC — no authentication required.");
    }
    else {
        authLines.push("This endpoint requires JWT authentication (Bearer token).");
    }
    if (endpoint.authContext.requiresContext) {
        authLines.push("Controller uses @Context() decorator → workspaceId and mailboxId come from the JWT session, NOT from the request body.");
    }
    if (endpoint.authContext.currentUserUsages.length > 0) {
        const usages = endpoint.authContext.currentUserUsages.join(", ");
        authLines.push(`Controller uses @CurrentUser(${usages === "full" ? "" : `'${usages}'`}) → userId / user object comes from JWT, NOT from the request body.`);
    }
    if (endpoint.authContext.requiredPermission) {
        const { action, subject } = endpoint.authContext.requiredPermission;
        authLines.push(`CASL permission required: ${action} on ${subject} — only include fields that this permission scope would allow.`);
    }
    if (endpoint.authContext.requiredRoles?.length) {
        authLines.push(`Required roles: ${endpoint.authContext.requiredRoles.join(", ")}.`);
    }
    // ── Parameters section ────────────────────────────────────────────────────
    const paramsSection = endpoint.params
        .map((p) => `  ${p.decorator}${p.name ? `('${p.name}')` : ""} ${p.typeName}${p.isOptional ? "?" : ""}`)
        .join("\n");
    // ── Service method section ────────────────────────────────────────────────
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

Controller method source code (use this to infer the DTO):
\`\`\`typescript
${endpoint.controllerMethodCode}
\`\`\``;
    // ── Prisma schema section ─────────────────────────────────────────────────
    const prismaSection = prismaSchema
        ? `
## Prisma Schema (relevant models)
\`\`\`prisma
${prismaSchema}
\`\`\``
        : `
## Prisma Schema: NOT AVAILABLE
Use conservative types (string, number, boolean). Prefer string for IDs.`;
    return `You are a senior NestJS developer working on a multi-tenant SaaS platform (virtual mailbox service).
Generate TypeScript DTO class(es) for the following endpoint, strictly following the project conventions below.

## Endpoint
HTTP Method: ${endpoint.httpMethod}
Full Path:   ${endpoint.routePath}
Controller:  ${endpoint.controllerClass}
Method:      ${endpoint.methodSignature}

## Controller Parameters
${paramsSection || "  (none)"}

## Auth & Authorization Context
${authLines.map((l) => `- ${l}`).join("\n")}
${serviceSection}
${prismaSection}

## PROJECT CONVENTIONS (MUST follow exactly)

### Imports
\`\`\`typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsEmail, IsNumber, IsBoolean, IsOptional, IsArray,
  ValidateNested, IsEnum, IsUUID, IsDate, IsInt, IsNotEmpty,
  Min, Max, MinLength, MaxLength, IsDateString
} from 'class-validator';
import { Type, Expose, Exclude, Transform } from 'class-transformer';
import { PartialType, PickType, OmitType } from '@nestjs/swagger';
\`\`\`

### Shared response wrappers (already exist in the project — use them when appropriate)
\`\`\`typescript
// For list endpoints that return paginated results:
class PaginatedResponseDto<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number; }
}

// For single-item endpoints:
class ApiResponseDto<T> {
  success: boolean;
  data: T;
}
\`\`\`

### DTO naming convention
- Request DTO:  Create${toPascalCase(endpoint.methodName.replace(/^(create|update|get|delete|list|find|fetch|set|add|remove|toggle)/i, ""))}Dto or [Action][Resource]Dto
- Response DTO: [Resource]ResponseDto
- Query DTO for GET list: [Resource]QueryDto (extends a base pagination query)

### Pagination query (for GET list endpoints)
\`\`\`typescript
// Standard query params for list endpoints:
export class [Resource]QueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;
}
\`\`\`

### Field rules
- All ID fields: use \`@IsUUID()\` and type \`string\`
- Optional fields: use \`@IsOptional()\` + \`@ApiPropertyOptional()\`
- Required fields: use \`@IsNotEmpty()\` + \`@ApiProperty()\`
- Enum fields: use \`@IsEnum(MyEnum)\` + \`@ApiProperty({ enum: MyEnum, enumName: 'MyEnum' })\`
- Nested objects: use \`@ValidateNested()\` + \`@Type(() => NestedDto)\`
- Date fields: use \`@IsDateString()\` for input, \`Date\` for response
- Do NOT include: passwordHash, password, secret — unless it's an auth endpoint returning tokens
- Do NOT include: workspaceId, mailboxId, userId — if they come from @Context() or @CurrentUser()
- For update DTOs: use \`PartialType(CreateXxxDto)\` instead of repeating all fields

### @ApiProperty examples
\`\`\`typescript
@ApiProperty({ description: 'Unique identifier', example: '550e8400-e29b-41d4-a716-446655440000' })
@ApiProperty({ description: 'User email address', example: 'user@example.com' })
@ApiProperty({ enum: MailType, enumName: 'MailType', description: 'Type of mail item' })
@ApiProperty({ type: () => AddressDto, description: 'Delivery address' })
@ApiProperty({ type: () => [ItemDto], description: 'List of items', isArray: true })
\`\`\`

## Task
Generate ${needsRequestDto ? "both request and response" : "only a response"} DTO class(es).
- Every class must be a proper TypeScript export class (not interface)
- No placeholder comments like "// add fields here" or "// TODO"
- Include all necessary imports at the top of each file
- Infer field names and types strictly from Prisma schema models and service method code
- If the service returns an array/paginated list, the response DTO should reflect that structure

Output format — use these EXACT delimiters (no JSON, no markdown fences):
${needsRequestDto ? `
===REQUEST_DTO===
<full TypeScript file with imports and export class>
===END_REQUEST_DTO===
` : ""}
===RESPONSE_DTO===
<full TypeScript file with imports and export class>
===END_RESPONSE_DTO===

${needsRequestDto ? "" : "Do NOT output a ===REQUEST_DTO=== block."}
IMPORTANT: Write the raw TypeScript code directly between the delimiters. No JSON wrapping. No markdown fences.`;
}
function toPascalCase(str) {
    return str
        .replace(/[-_](.)/g, (_, c) => c.toUpperCase())
        .replace(/^(.)/, (_, c) => c.toUpperCase());
}
