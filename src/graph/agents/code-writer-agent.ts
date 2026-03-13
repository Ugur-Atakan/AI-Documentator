import type { ChatGoogle } from "@langchain/google";
import type { DocumentationPlan, ConsolidatedOutput } from "../../types/controller-group.js";
import { buildWriterPrompt } from "../../prompts/writer-prompt.js";
import { withRetry } from "../../utils/retry.js";

/**
 * Agent 3: Code Writer
 *
 * Takes the Planner's JSON schema and generates actual TypeScript code.
 * Uses a fast model since generating code from a clear schema is straightforward.
 * Outputs 4 code sections: request DTOs, response DTOs, enums, decorators.
 */
export async function writeControllerCode(
  plan: DocumentationPlan,
  moduleName: string,
  prismaSchema: string,
  model: ChatGoogle
): Promise<ConsolidatedOutput> {
  const prompt = buildWriterPrompt(plan, prismaSchema || null);

  return withRetry(
    `Write ${plan.controllerClass} code`,
    async () => {
      const response = await model.invoke(prompt);
      const raw = String(response.content);

      return parseWriterResponse(raw, plan.controllerClass, moduleName);
    }
  );
}

interface ParsedSections {
  requestDtos: string | null;
  responseDtos: string | null;
  enums: string | null;
  decorators: string;
}

function parseWriterResponse(
  raw: string,
  controllerClass: string,
  moduleName: string
): ConsolidatedOutput {
  const sections = extractSections(raw, controllerClass);

  return {
    controllerClass,
    moduleName,
    requestDtoCode: sections.requestDtos,
    responseDtoCode: sections.responseDtos,
    enumsCode: sections.enums,
    decoratorsCode: sections.decorators,
    outputPaths: {
      requestDto: null, // Will be set by file writer
      responseDto: null,
      enums: null,
      decorators: "",
    },
  };
}

function extractSections(raw: string, controllerClass: string): ParsedSections {
  const requestDtos = extractBlock(raw, "===REQUEST_DTOS===", "===END_REQUEST_DTOS===");
  const responseDtos = extractBlock(raw, "===RESPONSE_DTOS===", "===END_RESPONSE_DTOS===");
  const enums = extractBlock(raw, "===ENUMS===", "===END_ENUMS===");
  const decorators = extractBlock(raw, "===DECORATORS===", "===END_DECORATORS===");

  if (!decorators) {
    throw new Error(
      `Could not extract DECORATORS section for ${controllerClass}. First 200 chars: ${raw.slice(0, 200)}`
    );
  }

  // Check if sections are "empty" markers
  const isEmptySection = (s: string | null): string | null => {
    if (!s) return null;
    const trimmed = s.trim();
    if (
      trimmed === "// No request DTOs" ||
      trimmed === "// No shared enums" ||
      trimmed.startsWith("// No ") ||
      trimmed.length === 0
    ) {
      return null;
    }
    return stripCodeFence(trimmed);
  };

  return {
    requestDtos: isEmptySection(requestDtos),
    responseDtos: responseDtos ? stripCodeFence(responseDtos.trim()) : null,
    enums: isEmptySection(enums),
    decorators: stripCodeFence(decorators.trim()),
  };
}

function extractBlock(text: string, startMarker: string, endMarker: string): string | null {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return null;

  const contentStart = startIdx + startMarker.length;
  const endIdx = text.indexOf(endMarker, contentStart);
  if (endIdx === -1) return null;

  return text.slice(contentStart, endIdx).trim();
}

function stripCodeFence(text: string): string {
  return text
    .replace(/^```(?:typescript|ts)?\s*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .trim();
}
