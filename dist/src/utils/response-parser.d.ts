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
export declare function parseDtoResponse(raw: string): {
    requestDtoCode: string | null;
    responseDtoCode: string;
};
export declare function parseSwaggerResponse(raw: string): {
    controllerDecorators: string;
};
/**
 * Parses consolidated writer output with per-controller sections.
 * Used by the new multi-agent pipeline.
 */
export declare function parseConsolidatedResponse(raw: string): {
    requestDtosCode: string | null;
    responseDtosCode: string | null;
    enumsCode: string | null;
    decoratorsCode: string;
};
/**
 * Parses the documentation plan JSON from the planner response.
 */
export declare function parsePlanResponse(raw: string): unknown;
