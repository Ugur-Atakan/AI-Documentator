import type { ConsolidatedOutput, ReviewResult, ReviewIssue } from "../../types/controller-group.js";

/**
 * Agent 4: Reviewer (Rule-based — NO LLM)
 *
 * Validates generated code using static analysis:
 * - Syntax validity (basic checks)
 * - @ApiProperty presence on every field
 * - Import completeness
 * - class-validator decorator correctness
 * - applyDecorators export correctness
 *
 * Returns pass/fail with detailed issues. If failed, Writer retries once.
 */
export function reviewGeneratedCode(output: ConsolidatedOutput): ReviewResult {
  const issues: ReviewIssue[] = [];

  // Review request DTOs
  if (output.requestDtoCode) {
    reviewDtoFile(output.requestDtoCode, "requestDto", issues);
  }

  // Review response DTOs
  if (output.responseDtoCode) {
    reviewDtoFile(output.responseDtoCode, "responseDto", issues);
  }

  // Review enums
  if (output.enumsCode) {
    reviewEnumFile(output.enumsCode, issues);
  }

  // Review decorators
  reviewDecoratorFile(output.decoratorsCode, issues);

  const errorCount = issues.filter((i) => i.severity === "error").length;

  return {
    passed: errorCount === 0,
    issues,
  };
}

function reviewDtoFile(
  code: string,
  fileType: "requestDto" | "responseDto",
  issues: ReviewIssue[]
): void {
  // Check: Has at least one export class
  if (!code.includes("export class")) {
    issues.push({
      severity: "error",
      message: "No export class found in DTO file",
      file: fileType,
    });
    return;
  }

  // Check: Every class field should have @ApiProperty or @ApiPropertyOptional
  const classBlocks = extractClassBlocks(code);
  for (const block of classBlocks) {
    const fields = extractFields(block.body);
    for (const field of fields) {
      if (
        !field.decorators.includes("ApiProperty") &&
        !field.decorators.includes("ApiPropertyOptional")
      ) {
        issues.push({
          severity: "error",
          message: `Field "${field.name}" in ${block.className} is missing @ApiProperty`,
          file: fileType,
        });
      }
    }
  }

  // Check: Import for @nestjs/swagger
  if (code.includes("@ApiProperty") && !code.includes("@nestjs/swagger")) {
    issues.push({
      severity: "error",
      message: "Missing import from '@nestjs/swagger' but uses @ApiProperty",
      file: fileType,
    });
  }

  // Check: Import for class-validator (if validators are used)
  const validatorDecorators = ["IsString", "IsNumber", "IsBoolean", "IsUUID", "IsOptional", "IsNotEmpty", "IsEnum", "IsArray", "IsInt", "IsDate", "IsDateString", "IsEmail"];
  const usedValidators = validatorDecorators.filter((v) => code.includes(`@${v}`));
  if (usedValidators.length > 0 && !code.includes("class-validator")) {
    issues.push({
      severity: "error",
      message: `Missing import from 'class-validator' but uses: ${usedValidators.join(", ")}`,
      file: fileType,
    });
  }

  // Check: Balanced braces (basic syntax check)
  checkBalancedBraces(code, fileType, issues);
}

function reviewEnumFile(code: string, issues: ReviewIssue[]): void {
  if (!code.includes("export enum") && !code.includes("export const")) {
    issues.push({
      severity: "warning",
      message: "Enum file does not contain export enum or export const",
      file: "enums",
    });
  }
}

function reviewDecoratorFile(code: string, issues: ReviewIssue[]): void {
  if (!code.includes("applyDecorators")) {
    issues.push({
      severity: "error",
      message: "Decorator file does not contain applyDecorators",
      file: "decorators",
    });
  }

  if (!code.includes("export const")) {
    issues.push({
      severity: "error",
      message: "Decorator file does not contain any export const",
      file: "decorators",
    });
  }

  // Check: Import for @nestjs/common (applyDecorators)
  if (!code.includes("@nestjs/common")) {
    issues.push({
      severity: "error",
      message: "Missing import from '@nestjs/common' for applyDecorators",
      file: "decorators",
    });
  }

  // Check: Import for @nestjs/swagger (API decorators)
  if (!code.includes("@nestjs/swagger")) {
    issues.push({
      severity: "error",
      message: "Missing import from '@nestjs/swagger' for API decorators",
      file: "decorators",
    });
  }

  // Check: No @ prefix inside applyDecorators (common LLM mistake)
  const applyBlocks = code.match(/applyDecorators\(([\s\S]*?)\);/g) ?? [];
  for (const block of applyBlocks) {
    if (block.match(/\(\s*@/)) {
      issues.push({
        severity: "error",
        message: "Found @ prefix inside applyDecorators() — decorator calls should not have @ prefix",
        file: "decorators",
      });
    }
  }

  checkBalancedBraces(code, "decorators", issues);
}

// --- Helpers ---

interface ClassBlock {
  className: string;
  body: string;
}

interface FieldInfo {
  name: string;
  decorators: string;
}

function extractClassBlocks(code: string): ClassBlock[] {
  const blocks: ClassBlock[] = [];
  const classRegex = /export class (\w+)(?:\s+extends\s+\w+(?:<[^>]+>)?)?\s*\{/g;

  let match: RegExpExecArray | null;
  while ((match = classRegex.exec(code)) !== null) {
    const className = match[1];
    const startIdx = match.index + match[0].length;

    // Find matching closing brace
    let depth = 1;
    let i = startIdx;
    while (i < code.length && depth > 0) {
      if (code[i] === "{") depth++;
      if (code[i] === "}") depth--;
      i++;
    }

    blocks.push({
      className,
      body: code.slice(startIdx, i - 1),
    });
  }

  return blocks;
}

function extractFields(classBody: string): FieldInfo[] {
  const fields: FieldInfo[] = [];
  const lines = classBody.split("\n");

  let currentDecorators = "";

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("@")) {
      currentDecorators += " " + trimmed;
    } else if (trimmed.match(/^\w+[\?!]?\s*[:=]/)) {
      // This is a field declaration
      const fieldName = trimmed.match(/^(\w+)/)?.[1] ?? "";
      if (fieldName && fieldName !== "constructor") {
        fields.push({
          name: fieldName,
          decorators: currentDecorators,
        });
      }
      currentDecorators = "";
    } else if (!trimmed.startsWith("//") && !trimmed.startsWith("/*") && trimmed !== "") {
      // Non-decorator, non-field line — reset
      currentDecorators = "";
    }
  }

  return fields;
}

function checkBalancedBraces(
  code: string,
  fileType: ReviewIssue["file"],
  issues: ReviewIssue[]
): void {
  let depth = 0;
  for (const char of code) {
    if (char === "{") depth++;
    if (char === "}") depth--;
  }

  if (depth !== 0) {
    issues.push({
      severity: "error",
      message: `Unbalanced braces (depth ${depth})`,
      file: fileType,
    });
  }
}
