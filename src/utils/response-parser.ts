/**
 * Extracts code blocks from Gemini responses using delimiter markers.
 * Much more robust than JSON parsing — TypeScript code with quotes,
 * template literals, and newlines won't break the extraction.
 *
 * Expected format from Gemini:
 *   ===REQUEST_DTO===
 *   import { ... } from '...'
 *   export class CreateUserDto { ... }
 *   ===END_REQUEST_DTO===
 *
 *   ===RESPONSE_DTO===
 *   import { ... } from '...'
 *   export class UserResponseDto { ... }
 *   ===END_RESPONSE_DTO===
 */

const MARKERS = {
  requestStart: "===REQUEST_DTO===",
  requestEnd: "===END_REQUEST_DTO===",
  responseStart: "===RESPONSE_DTO===",
  responseEnd: "===END_RESPONSE_DTO===",
  swaggerStart: "===SWAGGER_DECORATORS===",
  swaggerEnd: "===END_SWAGGER_DECORATORS===",
  // New consolidated markers (per-controller pipeline)
  requestDtosStart: "===REQUEST_DTOS===",
  requestDtosEnd: "===END_REQUEST_DTOS===",
  responseDtosStart: "===RESPONSE_DTOS===",
  responseDtosEnd: "===END_RESPONSE_DTOS===",
  enumsStart: "===ENUMS===",
  enumsEnd: "===END_ENUMS===",
  decoratorsStart: "===DECORATORS===",
  decoratorsEnd: "===END_DECORATORS===",
  planStart: "===DOCUMENTATION_PLAN===",
  planEnd: "===END_DOCUMENTATION_PLAN===",
} as const;

function extractBlock(text: string, startMarker: string, endMarker: string): string | null {
  const startIdx = text.indexOf(startMarker);
  if (startIdx === -1) return null;

  const contentStart = startIdx + startMarker.length;
  const endIdx = text.indexOf(endMarker, contentStart);
  if (endIdx === -1) return null;

  return text.slice(contentStart, endIdx).trim();
}

/**
 * Strips markdown code fences if present.
 * Handles: ```typescript\n...\n``` and ```\n...\n```
 */
function stripCodeFence(text: string): string {
  return text
    .replace(/^```(?:typescript|ts|json)?\s*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .trim();
}

export function parseDtoResponse(raw: string): {
  requestDtoCode: string | null;
  responseDtoCode: string;
} {
  // Strategy 1: Delimiter-based extraction (preferred)
  const requestDto = extractBlock(raw, MARKERS.requestStart, MARKERS.requestEnd);
  const responseDto = extractBlock(raw, MARKERS.responseStart, MARKERS.responseEnd);

  if (responseDto) {
    return {
      requestDtoCode: requestDto ? stripCodeFence(requestDto) : null,
      responseDtoCode: stripCodeFence(responseDto),
    };
  }

  // Strategy 2: JSON fallback (for backward compatibility)
  try {
    const cleaned = stripCodeFence(raw);
    const parsed = JSON.parse(cleaned);
    if (parsed.responseDtoCode) {
      return {
        requestDtoCode: parsed.requestDtoCode || null,
        responseDtoCode: parsed.responseDtoCode,
      };
    }
  } catch {
    // JSON parse failed, try next strategy
  }

  // Strategy 3: Extract from markdown code fences
  // Look for ```typescript ... ``` blocks
  const codeBlocks = [...raw.matchAll(/```(?:typescript|ts)?\s*\n([\s\S]*?)```/gi)]
    .map((m) => m[1].trim())
    .filter((block) => block.includes("export class"));

  if (codeBlocks.length >= 2) {
    return {
      requestDtoCode: codeBlocks[0],
      responseDtoCode: codeBlocks[1],
    };
  }
  if (codeBlocks.length === 1) {
    return {
      requestDtoCode: null,
      responseDtoCode: codeBlocks[0],
    };
  }

  // Strategy 4: Raw text contains export class — use the whole thing
  if (raw.includes("export class")) {
    const cleaned = stripCodeFence(raw);
    return {
      requestDtoCode: null,
      responseDtoCode: cleaned,
    };
  }

  throw new Error("Could not extract DTO code from response");
}

export function parseSwaggerResponse(raw: string): {
  controllerDecorators: string;
} {
  // Strategy 1: Delimiter-based
  const swagger = extractBlock(raw, MARKERS.swaggerStart, MARKERS.swaggerEnd);
  if (swagger) {
    return { controllerDecorators: stripCodeFence(swagger) };
  }

  // Strategy 2: JSON fallback
  try {
    const cleaned = stripCodeFence(raw);
    const parsed = JSON.parse(cleaned);
    if (parsed.controllerDecorators) {
      return { controllerDecorators: parsed.controllerDecorators };
    }
  } catch {
    // JSON failed
  }

  // Strategy 3: Extract decorator lines directly
  const lines = raw.split("\n").map((l) => l.trim());
  const decoratorLines = lines.filter((l) =>
    l.startsWith("@Api") || l.startsWith("@ApiBearerAuth")
  );

  if (decoratorLines.length > 0) {
    return { controllerDecorators: decoratorLines.join("\n") };
  }

  // Strategy 4: Code fence extraction
  const codeBlocks = [...raw.matchAll(/```(?:typescript|ts)?\s*\n([\s\S]*?)```/gi)]
    .map((m) => m[1].trim())
    .filter((block) => block.includes("@Api"));

  if (codeBlocks.length > 0) {
    return { controllerDecorators: codeBlocks[0] };
  }

  throw new Error("Could not extract Swagger decorators from response");
}

/**
 * Parses consolidated writer output with per-controller sections.
 * Used by the new multi-agent pipeline.
 */
export function parseConsolidatedResponse(raw: string): {
  requestDtosCode: string | null;
  responseDtosCode: string | null;
  enumsCode: string | null;
  decoratorsCode: string;
} {
  const requestDtos = extractBlock(raw, MARKERS.requestDtosStart, MARKERS.requestDtosEnd);
  const responseDtos = extractBlock(raw, MARKERS.responseDtosStart, MARKERS.responseDtosEnd);
  const enums = extractBlock(raw, MARKERS.enumsStart, MARKERS.enumsEnd);
  const decorators = extractBlock(raw, MARKERS.decoratorsStart, MARKERS.decoratorsEnd);

  if (!decorators) {
    throw new Error("Could not extract DECORATORS section from consolidated response");
  }

  const isEmpty = (s: string | null): string | null => {
    if (!s) return null;
    const trimmed = s.trim();
    if (trimmed.startsWith("// No ") || trimmed.length === 0) return null;
    return stripCodeFence(trimmed);
  };

  return {
    requestDtosCode: isEmpty(requestDtos),
    responseDtosCode: responseDtos ? stripCodeFence(responseDtos) : null,
    enumsCode: isEmpty(enums),
    decoratorsCode: stripCodeFence(decorators),
  };
}

/**
 * Parses the documentation plan JSON from the planner response.
 */
export function parsePlanResponse(raw: string): unknown {
  const plan = extractBlock(raw, MARKERS.planStart, MARKERS.planEnd);
  if (plan) {
    return JSON.parse(stripCodeFence(plan));
  }

  // Fallback: try to find JSON directly
  const jsonMatch = raw.match(/\{[\s\S]*"controllerClass"[\s\S]*"endpoints"[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  throw new Error("Could not extract documentation plan from response");
}
