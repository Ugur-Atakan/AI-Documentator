import type { ParsedEndpoint } from "../types/endpoint.js";
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
export declare function buildDtoPrompt(endpoint: ParsedEndpoint, prismaSchema: string | null): string;
