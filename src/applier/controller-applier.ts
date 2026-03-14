import * as fs from "fs";
import * as path from "path";
import { Project, type SourceFile, type MethodDeclaration } from "ts-morph";

export interface ApplyMatch {
  controllerFile: string;
  methodName: string;
  httpMethod: string;
  decoratorFile: string | null;
  decoratorExportName: string | null;
  requestDtoFile: string | null;
  requestDtoName: string | null;
  responseDtoFile: string | null;
  responseDtoName: string | null;
  actions: string[];
  skipped: boolean;
  skipReason?: string;
}

export interface ApplyResult {
  matches: ApplyMatch[];
  applied: number;
  skipped: number;
  controllers: number;
}

/** Swagger decorators that conflict with our generated applyDecorators */
const CONFLICTING_DECORATORS = [
  "ApiOperation",
  "ApiResponse",
  "ApiParam",
  "ApiQuery",
  "ApiBody",
  "ApiBearerAuth",
];

function kebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)
    .replace(/^-/, "");
}

/**
 * Derives the controller-level kebab name from the controller class.
 * UserController → "user"
 * MailboxController → "mailbox"
 */
function controllerToKebab(controllerClass: string): string {
  return controllerClass
    .replace(/Controller$/, "")
    .replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)
    .replace(/^-/, "");
}

function extractExportName(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/export const (\w+)\s*=/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract all export const names from a file (for consolidated decorator files).
 */
function extractAllExportNames(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const matches = [...content.matchAll(/export const (\w+)\s*=/g)];
    return matches.map((m) => m[1]);
  } catch {
    return [];
  }
}

function extractClassName(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const match = content.match(/export class (\w+)/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract all export class names from a file (for consolidated DTO files).
 */
function extractAllClassNames(filePath: string): string[] {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const matches = [...content.matchAll(/export class (\w+)/g)];
    return matches.map((m) => m[1]);
  } catch {
    return [];
  }
}

function relativeImport(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, toFile);
  rel = rel.replace(/\.ts$/, "");
  if (!rel.startsWith(".")) {
    rel = "./" + rel;
  }
  return rel.replace(/\\/g, "/");
}

function getHttpMethod(method: MethodDeclaration): string | null {
  const httpDecorators = ["Get", "Post", "Put", "Patch", "Delete"];
  for (const dec of method.getDecorators()) {
    const name = dec.getName();
    if (httpDecorators.includes(name)) {
      return name.toUpperCase();
    }
  }
  return null;
}

function hasDecoratorImport(sourceFile: SourceFile, importName: string): boolean {
  for (const imp of sourceFile.getImportDeclarations()) {
    for (const named of imp.getNamedImports()) {
      if (named.getName() === importName) return true;
    }
  }
  return false;
}

function hasDecoratorOnMethod(method: MethodDeclaration, decoratorName: string): boolean {
  return method.getDecorators().some((d) => d.getName() === decoratorName);
}

function getBodyParam(method: MethodDeclaration): { index: number; hasType: boolean; typeName: string | null } | null {
  for (let i = 0; i < method.getParameters().length; i++) {
    const param = method.getParameters()[i];
    for (const dec of param.getDecorators()) {
      if (dec.getName() === "Body") {
        const typeNode = param.getTypeNode();
        const typeName = typeNode?.getText() ?? null;
        const hasType = typeName !== null && typeName !== "any";
        return { index: i, hasType, typeName };
      }
    }
  }
  return null;
}

/**
 * Removes conflicting Swagger decorators from a method.
 * These are replaced by the consolidated applyDecorators call.
 */
function cleanConflictingDecorators(method: MethodDeclaration): string[] {
  const removed: string[] = [];

  for (const decorator of method.getDecorators()) {
    const name = decorator.getName();
    if (CONFLICTING_DECORATORS.includes(name)) {
      removed.push(`@${name}`);
      decorator.remove();
    }
  }

  return removed;
}

/**
 * Removes unused @nestjs/swagger imports after decorator cleanup.
 */
function cleanUnusedSwaggerImports(sourceFile: SourceFile): void {
  for (const imp of sourceFile.getImportDeclarations()) {
    const moduleSpec = imp.getModuleSpecifierValue();
    if (moduleSpec !== "@nestjs/swagger") continue;

    const namedImports = imp.getNamedImports();
    const usedImports: string[] = [];

    for (const named of namedImports) {
      const name = named.getName();
      // Check if this import is still used in the file
      const fullText = sourceFile.getFullText();
      // Count occurrences (excluding import line itself)
      const importLine = imp.getFullText();
      const restOfFile = fullText.replace(importLine, "");
      if (restOfFile.includes(name)) {
        usedImports.push(name);
      }
    }

    if (usedImports.length === 0) {
      imp.remove();
    } else if (usedImports.length < namedImports.length) {
      // Remove unused named imports
      for (const named of namedImports) {
        if (!usedImports.includes(named.getName())) {
          named.remove();
        }
      }
    }
  }
}

export function scanMatches(projectPath: string, modules?: string[]): ApplyMatch[] {
  const matches: ApplyMatch[] = [];
  const controllerFiles = findControllerFiles(projectPath, modules);

  // Use ts-morph to parse controllers properly
  const project = new Project({ tsConfigFilePath: undefined });

  for (const controllerFile of controllerFiles) {
    const controllerDir = path.dirname(controllerFile);
    const dtoDir = path.join(controllerDir, "dto");
    const decoratorDir = path.join(controllerDir, "decorators");

    const sourceFile = project.addSourceFileAtPath(controllerFile);
    const classes = sourceFile.getClasses();

    for (const classDecl of classes) {
      const controllerClassName = classDecl.getName() ?? "";
      const controllerKebab = controllerToKebab(controllerClassName);

      for (const method of classDecl.getMethods()) {
        const httpMethod = getHttpMethod(method);
        if (!httpMethod) continue;

        const name = method.getName();
        const methodKebab = kebabCase(name);

        // Try consolidated format first (per-controller), then legacy (per-endpoint)
        let decFile = findFile(decoratorDir, `${controllerKebab}.decorators.ts`);
        let requestDtoFile = findFile(dtoDir, `${controllerKebab}.request.dto.ts`);
        let responseDtoFile = findFile(dtoDir, `${controllerKebab}.response.dto.ts`);

        let decoratorExportName: string | null = null;
        let requestDtoName: string | null = null;
        let responseDtoName: string | null = null;

        if (decFile) {
          // Consolidated format: find the specific export for this method
          const allExports = extractAllExportNames(decFile);
          const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
          const expectedExport = `${capitalize(name)}Decorators`;
          decoratorExportName = allExports.includes(expectedExport) ? expectedExport : null;

          if (!decoratorExportName) {
            // Fallback: try to find any export matching the method name
            decoratorExportName = allExports.find((e) =>
              e.toLowerCase().includes(name.toLowerCase())
            ) ?? null;
          }
        }

        if (requestDtoFile) {
          // Consolidated format: find the specific class for this method
          const allClasses = extractAllClassNames(requestDtoFile);
          requestDtoName = allClasses.find((c) =>
            c.toLowerCase().includes(name.replace(/^(create|update|set|add)/i, "").toLowerCase()) ||
            c.toLowerCase().includes(methodKebab.replace(/-/g, "").toLowerCase())
          ) ?? allClasses[0] ?? null;
        }

        if (responseDtoFile) {
          const allClasses = extractAllClassNames(responseDtoFile);
          responseDtoName = allClasses.find((c) =>
            c.toLowerCase().includes(name.replace(/^(get|find|list|fetch)/i, "").toLowerCase()) ||
            c.toLowerCase().includes(methodKebab.replace(/-/g, "").toLowerCase())
          ) ?? allClasses[0] ?? null;
        }

        // If consolidated not found, try legacy per-endpoint format
        if (!decFile) {
          decFile = findFile(decoratorDir, `${methodKebab}.decorators.ts`);
          decoratorExportName = decFile ? extractExportName(decFile) : null;
        }
        if (!requestDtoFile) {
          requestDtoFile = findFile(dtoDir, `${methodKebab}.request.dto.ts`);
          requestDtoName = requestDtoFile ? extractClassName(requestDtoFile) : null;
        }
        if (!responseDtoFile) {
          responseDtoFile = findFile(dtoDir, `${methodKebab}.response.dto.ts`);
          responseDtoName = responseDtoFile ? extractClassName(responseDtoFile) : null;
        }

        const actions: string[] = [];
        let skipped = false;
        let skipReason: string | undefined;

        if (!decFile && !requestDtoFile) {
          skipped = true;
          skipReason = "no generated files";
        } else {
          if (decoratorExportName) {
            if (hasDecoratorOnMethod(method, decoratorExportName)) {
              skipped = true;
              skipReason = "already applied";
            } else {
              // Check for conflicting decorators that need cleanup
              const conflicting = method.getDecorators()
                .filter((d) => CONFLICTING_DECORATORS.includes(d.getName()))
                .map((d) => d.getName());

              if (conflicting.length > 0) {
                actions.push(`-${conflicting.map((c) => `@${c}`).join(",")}`);
              }
              actions.push(`+@${decoratorExportName}`);
            }
          }
          if (requestDtoName && !skipped) {
            const bodyParam = getBodyParam(method);
            if (bodyParam && !bodyParam.hasType) {
              actions.push(`+body ${requestDtoName}`);
            }
          }
          if (actions.length === 0 && !skipped) {
            skipped = true;
            skipReason = "nothing to change";
          }
        }

        matches.push({
          controllerFile,
          methodName: name,
          httpMethod,
          decoratorFile: decFile,
          decoratorExportName,
          requestDtoFile,
          requestDtoName,
          responseDtoFile,
          responseDtoName,
          actions,
          skipped,
          skipReason,
        });
      }
    }

    project.removeSourceFile(sourceFile);
  }

  return matches;
}

export function applyToControllers(matches: ApplyMatch[], dryRun: boolean): ApplyResult {
  const matchesByController = new Map<string, ApplyMatch[]>();

  for (const m of matches) {
    if (m.skipped) continue;
    const existing = matchesByController.get(m.controllerFile) ?? [];
    existing.push(m);
    matchesByController.set(m.controllerFile, existing);
  }

  let applied = 0;
  const skipped = matches.filter((m) => m.skipped).length;

  if (dryRun) {
    return {
      matches,
      applied: matches.filter((m) => !m.skipped).length,
      skipped,
      controllers: matchesByController.size,
    };
  }

  const project = new Project({ tsConfigFilePath: undefined });

  for (const [controllerFile, fileMatches] of matchesByController) {
    const sourceFile = project.addSourceFileAtPath(controllerFile);
    let modified = false;

    for (const match of fileMatches) {
      const classDecl = sourceFile.getClasses()[0];
      if (!classDecl) continue;

      const method = classDecl.getMethod(match.methodName);
      if (!method) continue;

      // 0. Clean conflicting Swagger decorators before adding new ones
      if (match.decoratorExportName && match.decoratorFile) {
        const removed = cleanConflictingDecorators(method);
        if (removed.length > 0) {
          modified = true;
        }
      }

      // 1. Add decorator import + apply on method
      if (match.decoratorExportName && match.decoratorFile) {
        if (!hasDecoratorImport(sourceFile, match.decoratorExportName)) {
          const importPath = relativeImport(controllerFile, match.decoratorFile);
          sourceFile.addImportDeclaration({
            moduleSpecifier: importPath,
            namedImports: [match.decoratorExportName],
          });
        }

        if (!hasDecoratorOnMethod(method, match.decoratorExportName)) {
          method.addDecorator({
            name: match.decoratorExportName,
          });
          modified = true;
          applied++;
        }
      }

      // 2. Type @Body() parameter with the request DTO
      if (match.requestDtoName && match.requestDtoFile) {
        const bodyParam = getBodyParam(method);
        if (bodyParam && !bodyParam.hasType) {
          if (!hasDecoratorImport(sourceFile, match.requestDtoName)) {
            const importPath = relativeImport(controllerFile, match.requestDtoFile);
            sourceFile.addImportDeclaration({
              moduleSpecifier: importPath,
              namedImports: [match.requestDtoName],
            });
          }

          const param = method.getParameters()[bodyParam.index];
          param.setType(match.requestDtoName);
          modified = true;
        }
      }
    }

    // Clean up unused swagger imports after all modifications
    if (modified) {
      cleanUnusedSwaggerImports(sourceFile);
      sourceFile.saveSync();
    }
  }

  return {
    matches,
    applied,
    skipped,
    controllers: matchesByController.size,
  };
}

// -- helpers --

function findControllerFiles(projectPath: string, modules?: string[]): string[] {
  const srcDir = path.join(projectPath, "src");
  const files: string[] = [];
  walkDir(srcDir, files, ".controller.ts");

  if (modules && modules.length > 0) {
    return files.filter((f) =>
      modules.some((mod) => f.toLowerCase().includes(`/${mod.toLowerCase()}/`))
    );
  }

  return files;
}

function walkDir(dir: string, result: string[], suffix: string): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      walkDir(fullPath, result, suffix);
    } else if (entry.isFile() && entry.name.endsWith(suffix)) {
      result.push(fullPath);
    }
  }
}

function findFile(dir: string, filename: string): string | null {
  const fullPath = path.join(dir, filename);
  return fs.existsSync(fullPath) ? fullPath : null;
}
