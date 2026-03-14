export type PrismaModelMap = Map<string, string>;
/**
 * Parses a Prisma schema string into a map of model name -> model block.
 * Also includes enum blocks since DTOs reference them.
 */
export declare function parsePrismaSchema(schema: string): PrismaModelMap;
/**
 * Given a set of model names, returns those models + any models they reference
 * through relations (one level deep).
 */
export declare function resolveRelatedModels(modelNames: string[], modelMap: PrismaModelMap): string[];
/**
 * Guesses Prisma model names from a route path when tracing failed.
 * e.g. /api/users/:id -> ['User']
 *      /mail-handler/tickets/:id -> ['Ticket', 'MailHandler']
 */
export declare function guessModelsFromPath(routePath: string): string[];
/**
 * Returns the filtered schema string for a given endpoint.
 * Falls back to full schema if no models can be resolved.
 */
export declare function getRelevantSchema(modelNames: string[], routePath: string, modelMap: PrismaModelMap, fullSchema: string): string;
