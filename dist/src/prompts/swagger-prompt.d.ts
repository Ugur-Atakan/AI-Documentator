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
export declare function buildSwaggerPrompt(endpoint: ParsedEndpoint, requestDtoCode: string | null, responseDtoCode: string): string;
