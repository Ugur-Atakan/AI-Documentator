import type { ConsolidatedOutput, ReviewResult } from "../../types/controller-group.js";
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
export declare function reviewGeneratedCode(output: ConsolidatedOutput): ReviewResult;
