import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import {
  Project,
  SyntaxKind,
  ClassDeclaration,
  MethodDeclaration,
  Node,
} from "ts-morph";
import type {
  ParsedEndpoint,
  ParsedParam,
  ParserOutput,
  TracedServiceMethod,
} from "../types/endpoint.js";

const HTTP_DECORATORS = ["Get", "Post", "Put", "Patch", "Delete"] as const;
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function makeId(controllerClass: string, methodName: string): string {
  return createHash("sha1")
    .update(`${controllerClass}::${methodName}`)
    .digest("hex")
    .slice(0, 12);
}

function normalizePath(...parts: string[]): string {
  return (
    "/" +
    parts
      .join("/")
      .replace(/\/+/g, "/")
      .replace(/^\//, "")
      .replace(/\/$/, "")
  );
}

function getControllerBasePath(cls: ClassDeclaration): string {
  for (const dec of cls.getDecorators()) {
    if (dec.getName() === "Controller") {
      const args = dec.getArguments();
      if (args.length > 0) {
        const arg = args[0];
        const text = arg.getText().replace(/['"]/g, "");
        return text;
      }
    }
  }
  return "";
}

function getHttpMethodAndPath(
  method: MethodDeclaration
): { httpMethod: HttpMethod; routePath: string } | null {
  for (const dec of method.getDecorators()) {
    const name = dec.getName();
    const upper = name.toUpperCase() as HttpMethod;
    if (HTTP_DECORATORS.includes(name as (typeof HTTP_DECORATORS)[number])) {
      const args = dec.getArguments();
      const subPath = args.length > 0 ? args[0].getText().replace(/['"]/g, "") : "";
      return { httpMethod: upper, routePath: subPath };
    }
  }
  return null;
}

function extractParams(method: MethodDeclaration): ParsedParam[] {
  const params: ParsedParam[] = [];
  for (const param of method.getParameters()) {
    let foundDecorator: ParsedParam["decorator"] | null = null;
    let decoratorName: string | undefined;

    for (const dec of param.getDecorators()) {
      const name = dec.getName();
      if (name === "Body") {
        foundDecorator = "@Body";
      } else if (name === "Param") {
        foundDecorator = "@Param";
        const args = dec.getArguments();
        decoratorName = args.length > 0 ? args[0].getText().replace(/['"]/g, "") : undefined;
      } else if (name === "Query") {
        foundDecorator = "@Query";
        const args = dec.getArguments();
        decoratorName = args.length > 0 ? args[0].getText().replace(/['"]/g, "") : undefined;
      } else if (name === "Headers") {
        foundDecorator = "@Headers";
      }
    }

    if (foundDecorator) {
      let typeName = "unknown";
      try {
        typeName = param.getType().getText();
      } catch {
        typeName = param.getTypeNode()?.getText() ?? "unknown";
      }

      params.push({
        decorator: foundDecorator,
        name: decoratorName,
        typeName,
        isOptional: param.isOptional(),
      });
    }
  }
  return params;
}

function extractPrismaModels(sourceCode: string): string[] {
  const matches = sourceCode.matchAll(/this\.prisma\.(\w+)\./g);
  const models = new Set<string>();
  for (const match of matches) {
    const model = match[1].charAt(0).toUpperCase() + match[1].slice(1);
    models.add(model);
  }
  return Array.from(models);
}

function traceServiceMethod(
  method: MethodDeclaration,
  project: Project
): { result: TracedServiceMethod | null; reason?: string } {
  const body = method.getBody();
  if (!body) return { result: null, reason: "No method body" };

  // Strategy A & B: Find call expressions like this.xService.methodName(...)
  const callExprs = body.getDescendantsOfKind(SyntaxKind.CallExpression);

  for (const call of callExprs) {
    const expr = call.getExpression();
    if (!Node.isPropertyAccessExpression(expr)) continue;

    const obj = expr.getExpression();
    if (!Node.isPropertyAccessExpression(obj)) continue;

    const receiver = obj.getExpression();
    if (!Node.isThisExpression(receiver)) continue;

    const fieldName = obj.getName();
    if (!fieldName.toLowerCase().includes("service")) continue;

    const calledMethodName = expr.getName();

    try {
      const symbol = expr.getSymbol();
      if (!symbol) throw new Error("No symbol");

      const declarations = symbol.getDeclarations();
      const serviceMethodDecl = declarations.find((d) =>
        Node.isMethodDeclaration(d)
      ) as MethodDeclaration | undefined;

      if (serviceMethodDecl) {
        const serviceClass = serviceMethodDecl.getParent();
        const serviceClassName = Node.isClassDeclaration(serviceClass)
          ? (serviceClass.getName() ?? "UnknownService")
          : "UnknownService";

        const sourceCode = serviceMethodDecl.getText();
        const returnTypeName = (() => {
          try {
            return serviceMethodDecl.getReturnType().getText();
          } catch {
            return serviceMethodDecl.getReturnTypeNode()?.getText() ?? "unknown";
          }
        })();

        return {
          result: {
            serviceClassName,
            methodName: calledMethodName,
            sourceCode,
            returnTypeName,
            prismaModelsReferenced: extractPrismaModels(sourceCode),
          },
        };
      }
    } catch {
      // Strategy A/B failed for this call, try regex fallback below
    }

    // Strategy C: regex fallback - find the service class via constructor injection
    try {
      const classDecl = method.getParent();
      if (!Node.isClassDeclaration(classDecl)) continue;

      const ctor = classDecl.getConstructors()[0];
      if (!ctor) continue;

      let serviceTypeName: string | undefined;
      for (const ctorParam of ctor.getParameters()) {
        const paramName = ctorParam.getName();
        if (paramName === fieldName) {
          serviceTypeName = ctorParam.getTypeNode()?.getText();
          break;
        }
      }

      if (!serviceTypeName) continue;

      // Find the class in the project
      for (const sourceFile of project.getSourceFiles()) {
        for (const cls of sourceFile.getClasses()) {
          if (cls.getName() === serviceTypeName) {
            const targetMethod = cls.getMethod(calledMethodName);
            if (targetMethod) {
              const sourceCode = targetMethod.getText();
              const returnTypeName = (() => {
                try {
                  return targetMethod.getReturnType().getText();
                } catch {
                  return targetMethod.getReturnTypeNode()?.getText() ?? "unknown";
                }
              })();

              return {
                result: {
                  serviceClassName: serviceTypeName,
                  methodName: calledMethodName,
                  sourceCode,
                  returnTypeName,
                  prismaModelsReferenced: extractPrismaModels(sourceCode),
                },
              };
            }
          }
        }
      }
    } catch {
      // Strategy C also failed
    }
  }

  const bodyText = body.getText();
  const serviceCallMatch = bodyText.match(/this\.(\w*[Ss]ervice\w*)\.(\w+)\(/);
  if (serviceCallMatch) {
    return {
      result: null,
      reason: `Found service call this.${serviceCallMatch[1]}.${serviceCallMatch[2]}() but could not resolve method declaration`,
    };
  }

  return { result: null, reason: "No service call found in method body" };
}

function buildMethodSignature(method: MethodDeclaration): string {
  const params = method
    .getParameters()
    .map((p) => p.getText())
    .join(", ");
  const returnType = (() => {
    try {
      return ": " + method.getReturnType().getText();
    } catch {
      const node = method.getReturnTypeNode();
      return node ? ": " + node.getText() : "";
    }
  })();
  return `${method.getName()}(${params})${returnType}`;
}

function parseNestJSProject(projectRoot: string): ParserOutput {
  const tsconfigPath = path.join(projectRoot, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) {
    throw new Error(`tsconfig.json not found at: ${tsconfigPath}`);
  }

  const project = new Project({
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: false,
  });

  // Also add any .ts files not included in tsconfig
  project.addSourceFilesFromTsConfig(tsconfigPath);

  const endpoints: ParsedEndpoint[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();
    // Skip node_modules
    if (filePath.includes("node_modules")) continue;

    for (const cls of sourceFile.getClasses()) {
      const isController = cls
        .getDecorators()
        .some((d) => d.getName() === "Controller");
      if (!isController) continue;

      const controllerClass = cls.getName() ?? "UnknownController";
      const basePath = getControllerBasePath(cls);

      for (const method of cls.getMethods()) {
        const httpInfo = getHttpMethodAndPath(method);
        if (!httpInfo) continue;

        const { httpMethod, routePath: subPath } = httpInfo;
        const fullPath = normalizePath(basePath, subPath);
        const params = extractParams(method);
        const { result: tracedService, reason: traceFailureReason } =
          traceServiceMethod(method, project);

        endpoints.push({
          id: makeId(controllerClass, method.getName()),
          controllerClass,
          controllerFilePath: filePath,
          httpMethod,
          routePath: fullPath,
          methodName: method.getName(),
          methodSignature: buildMethodSignature(method),
          params,
          controllerMethodCode: method.getText(),
          tracedService,
          traceFailureReason,
        });
      }
    }
  }

  // Read Prisma schema
  const prismaSchemaPath = path.join(projectRoot, "prisma", "schema.prisma");
  const hasPrisma = fs.existsSync(prismaSchemaPath);

  return {
    projectRoot,
    parsedAt: new Date().toISOString(),
    prismaSchemaPath: hasPrisma ? prismaSchemaPath : null,
    prismaSchemaContent: hasPrisma
      ? fs.readFileSync(prismaSchemaPath, "utf-8")
      : null,
    endpoints,
  };
}

// CLI entry
const args = process.argv.slice(2);
const projectFlag = args.indexOf("--project");

if (projectFlag === -1 || !args[projectFlag + 1]) {
  console.error("Usage: tsx src/parser/nestjs-parser.ts --project /path/to/nestjs-project");
  process.exit(1);
}

const projectRoot = path.resolve(args[projectFlag + 1]);
console.error(`Parsing NestJS project at: ${projectRoot}`);

try {
  const output = parseNestJSProject(projectRoot);
  console.error(`Found ${output.endpoints.length} endpoints`);
  console.error(`Prisma schema: ${output.prismaSchemaPath ?? "not found"}`);
  process.stdout.write(JSON.stringify(output, null, 2));
} catch (err) {
  console.error("Parse error:", err);
  process.exit(1);
}
