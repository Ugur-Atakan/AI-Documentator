import * as fs from "fs";
import * as path from "path";
import type { EndpointTask, GeneratedDocs } from "../types/endpoint.js";

function kebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)
    .replace(/^-/, "");
}

function buildDecoratorFileContent(
  endpoint: EndpointTask["endpoint"],
  controllerDecorators: string,
  requestDtoName: string | null,
  responseDtoName: string
): string {
  const lines: string[] = [];

  lines.push(`import { applyDecorators } from '@nestjs/common';`);
  lines.push(
    `import { ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';`
  );

  if (requestDtoName) {
    const dtoFile = `./${kebabCase(endpoint.methodName)}.request.dto`;
    lines.push(`import { ${requestDtoName} } from '${dtoFile}';`);
  }

  const responseDtoFile = `./${kebabCase(endpoint.methodName)}.response.dto`;
  lines.push(`import { ${responseDtoName} } from '${responseDtoFile}';`);

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

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function writeGeneratedDocs(
  task: EndpointTask,
  docs: GeneratedDocs
): string[] {
  const controllerDir = path.dirname(task.endpoint.controllerFilePath);
  const dtoDir = path.join(controllerDir, "dto");
  const methodKebab = kebabCase(task.endpoint.methodName);

  if (!fs.existsSync(dtoDir)) {
    fs.mkdirSync(dtoDir, { recursive: true });
  }

  const written: string[] = [];

  // Write request DTO
  if (docs.requestDtoCode) {
    const requestDtoPath = path.join(dtoDir, `${methodKebab}.request.dto.ts`);
    fs.writeFileSync(requestDtoPath, docs.requestDtoCode, "utf-8");
    written.push(requestDtoPath);
  }

  // Write response DTO
  const responseDtoPath = path.join(dtoDir, `${methodKebab}.response.dto.ts`);
  fs.writeFileSync(responseDtoPath, docs.responseDtoCode, "utf-8");
  written.push(responseDtoPath);

  // Build and write decorator file
  const requestDtoName = docs.requestDtoCode
    ? docs.requestDtoCode.match(/export class (\w+)/)?.[1] ?? null
    : null;
  const responseDtoName =
    docs.responseDtoCode.match(/export class (\w+)/)?.[1] ?? "ResponseDto";

  const decoratorContent = buildDecoratorFileContent(
    task.endpoint,
    docs.controllerDecorators,
    requestDtoName,
    responseDtoName
  );

  const decoratorPath = path.join(
    controllerDir,
    `${methodKebab}.decorators.ts`
  );
  fs.writeFileSync(decoratorPath, decoratorContent, "utf-8");
  written.push(decoratorPath);

  return written;
}
