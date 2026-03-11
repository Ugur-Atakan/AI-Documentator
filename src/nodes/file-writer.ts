import * as fs from "fs";
import * as path from "path";
import type { EndpointTask, GeneratedDocs } from "../types/endpoint.js";

export interface FileWriterOptions {
  /** If set, all output goes to this directory instead of next to the controller. */
  outputDir?: string;
  /** Print to stdout instead of writing files (safe preview mode) */
  dryRun?: boolean;
  /** Skip generation if the output file already exists */
  skipExisting?: boolean;
}

function kebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)
    .replace(/^-/, "");
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Compute a POSIX-style relative import path from `fromFile` to `toFile`.
 * Always starts with './' or '../' — never an absolute path.
 *
 * Example:
 *   fromFile: /project/src/dtos/create-user.decorators.ts
 *   toFile:   /project/src/dtos/create-user.response.dto.ts
 *   result:   ./create-user.response.dto
 */
function relativeImport(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, toFile);

  // Remove .ts extension for import
  rel = rel.replace(/\.ts$/, "");

  // Ensure it starts with ./ or ../
  if (!rel.startsWith(".")) {
    rel = "./" + rel;
  }

  // Normalize to posix separators (for Windows compat)
  return rel.replace(/\\/g, "/");
}

function buildDecoratorFileContent(
  task: EndpointTask,
  controllerDecorators: string,
  requestDtoName: string | null,
  responseDtoName: string,
  decoratorFilePath: string,
  requestDtoPath: string | null,
  responseDtoPath: string
): string {
  const { endpoint } = task;
  const lines: string[] = [];

  lines.push(`import { applyDecorators } from '@nestjs/common';`);
  lines.push(
    `import { ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';`
  );

  // Always use relative imports computed from actual file paths
  if (requestDtoName && requestDtoPath) {
    const importPath = relativeImport(decoratorFilePath, requestDtoPath);
    lines.push(`import { ${requestDtoName} } from '${importPath}';`);
  }

  const responseImportPath = relativeImport(decoratorFilePath, responseDtoPath);
  lines.push(`import { ${responseDtoName} } from '${responseImportPath}';`);

  lines.push("");
  lines.push(`export const ${capitalize(endpoint.methodName)}Decorators = applyDecorators(`);

  const decoratorLines = controllerDecorators
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const dec of decoratorLines) {
    lines.push(`  ${dec},`);
  }

  lines.push(");");
  lines.push("");

  return lines.join("\n");
}

function writeOrDryRun(
  filePath: string,
  content: string,
  dryRun: boolean,
  skipExisting: boolean,
  written: string[]
): void {
  if (skipExisting && fs.existsSync(filePath)) {
    return;
  }

  if (dryRun) {
    written.push(`[dry-run] ${filePath}`);
    return;
  }

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, content, "utf-8");
  written.push(filePath);
}

export function writeGeneratedDocs(
  task: EndpointTask,
  docs: GeneratedDocs,
  options: FileWriterOptions = {}
): string[] {
  const { outputDir, dryRun = false, skipExisting = true } = options;

  const methodKebab = kebabCase(task.endpoint.methodName);
  const controllerDir = path.dirname(task.endpoint.controllerFilePath);

  // Where to write files
  const dtoDir = outputDir ?? path.join(controllerDir, "dto");
  const decoratorDir = outputDir ?? controllerDir;

  const written: string[] = [];

  // ── Request DTO ──────────────────────────────────────────────────────────
  const requestDtoPath = docs.requestDtoCode
    ? path.join(dtoDir, `${methodKebab}.request.dto.ts`)
    : null;

  if (docs.requestDtoCode && requestDtoPath) {
    writeOrDryRun(requestDtoPath, docs.requestDtoCode, dryRun, skipExisting, written);
  }

  // ── Response DTO ─────────────────────────────────────────────────────────
  const responseDtoPath = path.join(dtoDir, `${methodKebab}.response.dto.ts`);
  writeOrDryRun(responseDtoPath, docs.responseDtoCode, dryRun, skipExisting, written);

  // ── Decorator file ───────────────────────────────────────────────────────
  const requestDtoName = docs.requestDtoCode
    ? docs.requestDtoCode.match(/export class (\w+)/)?.[1] ?? null
    : null;
  const responseDtoName =
    docs.responseDtoCode.match(/export class (\w+)/)?.[1] ?? "ResponseDto";

  const decoratorPath = path.join(decoratorDir, `${methodKebab}.decorators.ts`);

  const decoratorContent = buildDecoratorFileContent(
    task,
    docs.controllerDecorators,
    requestDtoName,
    responseDtoName,
    decoratorPath,
    requestDtoPath,
    responseDtoPath
  );

  writeOrDryRun(decoratorPath, decoratorContent, dryRun, skipExisting, written);

  return written;
}
