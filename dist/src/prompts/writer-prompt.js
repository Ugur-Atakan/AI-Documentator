/**
 * Builds the Code Writer agent prompt.
 * Takes a structured JSON plan from the Planner and generates actual TypeScript code
 * for all DTOs, enums, and decorators in a single controller.
 */
export function buildWriterPrompt(plan, prismaSchema) {
    const planJson = JSON.stringify(plan, null, 2);
    const prismaSection = prismaSchema
        ? `## Prisma Schema (for type reference)
\`\`\`prisma
${prismaSchema}
\`\`\``
        : "";
    return `You are a senior NestJS developer. Generate TypeScript code from the following documentation plan.

## Documentation Plan
\`\`\`json
${planJson}
\`\`\`

${prismaSection}

## Code Generation Rules

### Imports
- Request/Response DTOs: import from 'class-validator', 'class-transformer', '@nestjs/swagger'
- Enums: plain TypeScript enums, no external dependencies
- Decorators: import from '@nestjs/common', '@nestjs/swagger', and reference generated DTOs

### Field Requirements
- EVERY field MUST have \`@ApiProperty({ description: '...', example: ... })\` or \`@ApiPropertyOptional\`
- Optional fields: \`@IsOptional()\` + \`@ApiPropertyOptional()\`
- Required fields: \`@IsNotEmpty()\` + \`@ApiProperty()\`
- UUID fields: \`@IsUUID()\`
- Enum fields: \`@IsEnum(MyEnum)\` + \`@ApiProperty({ enum: MyEnum, enumName: 'MyEnum' })\`
- Nested objects: \`@ValidateNested()\` + \`@Type(() => NestedDto)\`
- Arrays: \`@IsArray()\` + \`@ValidateNested({ each: true })\` for nested arrays

### DTO Patterns
- Update DTOs that use PartialType: \`export class UpdateXxxDto extends PartialType(CreateXxxDto) {}\`
- All classes must be \`export class\` (not interface)
- Include ALL necessary imports at the top of each section
- No placeholder comments or TODOs

### Decorator Rules
- Output decorator function calls WITHOUT @ prefix (used inside applyDecorators)
- Each decorator on its own line
- Use single quotes for strings
- Reference DTO class names from the plan

## Output Format

Generate code in these EXACT sections with delimiters:

===REQUEST_DTOS===
// All request DTO classes for this controller, with imports
// If no request DTOs needed, output: // No request DTOs
===END_REQUEST_DTOS===

===RESPONSE_DTOS===
// All response DTO classes for this controller, with imports
===END_RESPONSE_DTOS===

===ENUMS===
// All shared enums (if any)
// If no enums, output: // No shared enums
===END_ENUMS===

===DECORATORS===
// All applyDecorators exports, one per endpoint method
// Format:
// export const MethodNameDecorators = applyDecorators(
//   ApiOperation({ summary: '...' }),
//   ApiResponse({ status: 200, type: ResponseDto }),
//   ...
// );
===END_DECORATORS===

IMPORTANT:
- Write raw TypeScript code between delimiters. No JSON wrapping. No markdown fences.
- Each section must be a complete, self-contained TypeScript file with all imports.
- Decorator section must import DTO types using relative imports (assume DTOs are in ../dto/ relative to decorators/).`;
}
