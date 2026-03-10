export type PrismaModelMap = Map<string, string>;

/**
 * Parses a Prisma schema string into a map of model name -> model block.
 * Also includes enum blocks since DTOs reference them.
 */
export function parsePrismaSchema(schema: string): PrismaModelMap {
  const map: PrismaModelMap = new Map();

  // Match model and enum blocks
  const blockRegex = /^(model|enum)\s+(\w+)\s*\{[^}]*\}/gm;
  for (const match of schema.matchAll(blockRegex)) {
    const name = match[2];
    map.set(name, match[0]);
  }

  return map;
}

/**
 * Given a set of model names, returns those models + any models they reference
 * through relations (one level deep).
 */
export function resolveRelatedModels(
  modelNames: string[],
  modelMap: PrismaModelMap
): string[] {
  const resolved = new Set<string>(modelNames);

  for (const name of modelNames) {
    const block = modelMap.get(name);
    if (!block) continue;

    // Find type references: lines like "posts Post[]" or "user User?"
    // Matches capitalized type names that exist in the schema
    const typeRefs = block.matchAll(/\s+\w+\s+(\w+)[\[\]?]/g);
    for (const ref of typeRefs) {
      const refName = ref[1];
      if (modelMap.has(refName)) {
        resolved.add(refName);
      }
    }
  }

  return Array.from(resolved);
}

/**
 * Guesses Prisma model names from a route path when tracing failed.
 * e.g. /api/users/:id -> ['User']
 *      /mail-handler/tickets/:id -> ['Ticket', 'MailHandler']
 */
export function guessModelsFromPath(routePath: string): string[] {
  const segments = routePath
    .split("/")
    .filter((s) => s && !s.startsWith(":") && s !== "api");

  return segments.map((s) => {
    // Remove trailing 's' for plurals: users -> User, tickets -> Ticket
    const singular = s.endsWith("s") ? s.slice(0, -1) : s;
    // kebab-case to PascalCase: mail-handler -> MailHandler
    return singular
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("");
  });
}

/**
 * Returns the filtered schema string for a given endpoint.
 * Falls back to full schema if no models can be resolved.
 */
export function getRelevantSchema(
  modelNames: string[],
  routePath: string,
  modelMap: PrismaModelMap,
  fullSchema: string
): string {
  if (modelMap.size === 0) return fullSchema;

  // Start with traced models, add path-guessed models as fallback
  const candidates = [
    ...modelNames,
    ...guessModelsFromPath(routePath),
  ];

  // Filter to only models that actually exist in the schema
  const existing = candidates.filter((m) => modelMap.has(m));

  // If nothing matched, return full schema
  if (existing.length === 0) return fullSchema;

  const resolved = resolveRelatedModels(existing, modelMap);

  // Also include all enums (they're small and hard to pre-filter)
  const enums: string[] = [];
  for (const [, block] of modelMap) {
    if (block.startsWith("enum")) enums.push(block);
  }

  const modelBlocks = resolved
    .map((name) => modelMap.get(name))
    .filter(Boolean) as string[];

  return [...modelBlocks, ...enums].join("\n\n");
}
