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
 * Extract the module/feature name from a controller file path.
 *
 * Examples:
 *   /project/src/modules/mailbox/mailbox.controller.ts  → "mailbox"
 *   /project/src/modules/admin/admin.controller.ts      → "admin"
 *   /project/src/auth/auth.controller.ts                → "auth"
 *   /project/src/app.controller.ts                      → "app"
 */
function extractModuleName(controllerFilePath: string): string {
  const dir = path.dirname(controllerFilePath);
  return path.basename(dir);
}

/**
 * Compute a POSIX-style relative import path from `fromFile` to `toFile`.
 * Always starts with './' or '../' — never an absolute path.
 */
function relativeImport(fromFile: string, toFile: string): string {
  const fromDir = path.dirname(fromFile);
  let rel = path.relative(fromDir, toFile);
  rel = rel.replace(/\.ts$/, "");
  if (!rel.startsWith(".")) {
    rel = "./" + rel;
  }
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

  // When outputDir is set, organize by module: outputDir/{module}/dto/
  // When not set, write next to the controller: controller-dir/dto/
  let dtoDir: string;
  let decoratorDir: string;

  if (outputDir) {
    const moduleName = extractModuleName(task.endpoint.controllerFilePath);
    const moduleDir = path.join(outputDir, moduleName);
    dtoDir = path.join(moduleDir, "dto");
    decoratorDir = path.join(moduleDir, "decorators");
  } else {
    dtoDir = path.join(controllerDir, "dto");
    decoratorDir = path.join(controllerDir, "decorators");
  }

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
