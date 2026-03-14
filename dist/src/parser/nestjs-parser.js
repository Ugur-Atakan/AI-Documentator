import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";
import { Project, SyntaxKind, Node, } from "ts-morph";
const HTTP_DECORATORS = ["Get", "Post", "Put", "Patch", "Delete"];
function makeId(controllerClass, methodName) {
    return createHash("sha1")
        .update(`${controllerClass}::${methodName}`)
        .digest("hex")
        .slice(0, 12);
}
function normalizePath(...parts) {
    return ("/" +
        parts
            .join("/")
            .replace(/\/+/g, "/")
            .replace(/^\//, "")
            .replace(/\/$/, ""));
}
function getControllerBasePath(cls) {
    for (const dec of cls.getDecorators()) {
        if (dec.getName() === "Controller") {
            const args = dec.getArguments();
            if (args.length > 0) {
                return args[0].getText().replace(/['"]/g, "");
            }
        }
    }
    return "";
}
function getHttpMethodAndPath(method) {
    for (const dec of method.getDecorators()) {
        const name = dec.getName();
        const upper = name.toUpperCase();
        if (HTTP_DECORATORS.includes(name)) {
            const args = dec.getArguments();
            const subPath = args.length > 0 ? args[0].getText().replace(/['"]/g, "") : "";
            return { httpMethod: upper, routePath: subPath };
        }
    }
    return null;
}
function extractParams(method) {
    const params = [];
    for (const param of method.getParameters()) {
        let foundDecorator = null;
        let decoratorName;
        for (const dec of param.getDecorators()) {
            const name = dec.getName();
            if (name === "Body") {
                foundDecorator = "@Body";
            }
            else if (name === "Param") {
                foundDecorator = "@Param";
                const args = dec.getArguments();
                decoratorName = args.length > 0 ? args[0].getText().replace(/['"]/g, "") : undefined;
            }
            else if (name === "Query") {
                foundDecorator = "@Query";
                const args = dec.getArguments();
                decoratorName = args.length > 0 ? args[0].getText().replace(/['"]/g, "") : undefined;
            }
            else if (name === "Headers") {
                foundDecorator = "@Headers";
            }
        }
        if (foundDecorator) {
            let typeName = "unknown";
            try {
                typeName = param.getType().getText();
            }
            catch {
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
function extractPrismaModels(sourceCode) {
    const matches = sourceCode.matchAll(/this\.prisma\.(\w+)\./g);
    const models = new Set();
    for (const match of matches) {
        const model = match[1].charAt(0).toUpperCase() + match[1].slice(1);
        models.add(model);
    }
    return Array.from(models);
}
/**
 * Extract authentication / authorization context from class and method decorators.
 * Handles vmh-server patterns: @Public, @CurrentUser, @Context,
 * @RequirePermission, @Roles, @UseGuards.
 */
function extractAuthContext(cls, method) {
    const classDecNames = cls.getDecorators().map((d) => d.getName());
    const methodDecNames = method.getDecorators().map((d) => d.getName());
    const allDecNames = [...classDecNames, ...methodDecNames];
    const isPublic = allDecNames.includes("Public");
    // Collect all guards from class-level and method-level @UseGuards(...)
    const guards = [];
    for (const src of [cls.getDecorators(), method.getDecorators()]) {
        for (const dec of src) {
            if (dec.getName() === "UseGuards") {
                for (const arg of dec.getArguments()) {
                    guards.push(arg.getText().trim());
                }
            }
        }
    }
    const hasJwtGuard = guards.some((g) => g.includes("JwtAuthGuard") || g.includes("AuthGuard"));
    const requiresBearerAuth = !isPublic &&
        (allDecNames.includes("ApiBearerAuth") || hasJwtGuard);
    // @RequirePermission(action, subject)
    let requiredPermission;
    for (const dec of method.getDecorators()) {
        if (dec.getName() === "RequirePermission") {
            const args = dec.getArguments();
            if (args.length >= 2) {
                requiredPermission = {
                    action: args[0].getText().replace(/['"]/g, ""),
                    subject: args[1].getText().replace(/['"]/g, ""),
                };
            }
        }
    }
    // @Roles(RoleType.ADMIN, ...)
    let requiredRoles;
    for (const dec of [...cls.getDecorators(), ...method.getDecorators()]) {
        if (dec.getName() === "Roles") {
            requiredRoles = dec.getArguments().map((a) => a.getText().replace(/['"]/g, ""));
        }
    }
    // @CurrentUser() or @CurrentUser('id')
    const currentUserUsages = [];
    for (const param of method.getParameters()) {
        for (const dec of param.getDecorators()) {
            if (dec.getName() === "CurrentUser") {
                const args = dec.getArguments();
                currentUserUsages.push(args.length > 0 ? args[0].getText().replace(/['"]/g, "") : "full");
            }
        }
    }
    // @Context() — provides workspaceId + mailboxId from JWT
    const requiresContext = method
        .getParameters()
        .some((p) => p.getDecorators().some((d) => d.getName() === "Context"));
    return {
        isPublic,
        requiresBearerAuth,
        guards,
        requiredPermission,
        requiredRoles,
        currentUserUsages,
        requiresContext,
    };
}
/**
 * Detect which Swagger decorators already exist at class or method level
 * so prompts can avoid generating duplicates.
 */
function extractExistingSwagger(cls, method) {
    const classDecNames = cls.getDecorators().map((d) => d.getName());
    const methodDecNames = method.getDecorators().map((d) => d.getName());
    const apiTags = [];
    for (const dec of cls.getDecorators()) {
        if (dec.getName() === "ApiTags") {
            for (const arg of dec.getArguments()) {
                apiTags.push(arg.getText().replace(/['"]/g, ""));
            }
        }
    }
    return {
        hasApiOperation: methodDecNames.includes("ApiOperation"),
        hasApiResponse: methodDecNames.includes("ApiResponse"),
        hasBearerAuthOnClass: classDecNames.includes("ApiBearerAuth"),
        hasApiTags: classDecNames.includes("ApiTags"),
        apiTags,
        hasApiBody: methodDecNames.includes("ApiBody"),
    };
}
function traceServiceMethod(method, project) {
    const body = method.getBody();
    if (!body)
        return { result: null, reason: "No method body" };
    const callExprs = body.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const call of callExprs) {
        const expr = call.getExpression();
        if (!Node.isPropertyAccessExpression(expr))
            continue;
        const obj = expr.getExpression();
        if (!Node.isPropertyAccessExpression(obj))
            continue;
        const receiver = obj.getExpression();
        if (!Node.isThisExpression(receiver))
            continue;
        const fieldName = obj.getName();
        if (!fieldName.toLowerCase().includes("service"))
            continue;
        const calledMethodName = expr.getName();
        // Strategy A: symbol resolution (fastest, most accurate)
        try {
            const symbol = expr.getSymbol();
            if (!symbol)
                throw new Error("No symbol");
            const declarations = symbol.getDeclarations();
            const serviceMethodDecl = declarations.find((d) => Node.isMethodDeclaration(d));
            if (serviceMethodDecl) {
                const serviceClass = serviceMethodDecl.getParent();
                const serviceClassName = Node.isClassDeclaration(serviceClass)
                    ? (serviceClass.getName() ?? "UnknownService")
                    : "UnknownService";
                const sourceCode = serviceMethodDecl.getText();
                const returnTypeName = (() => {
                    try {
                        return serviceMethodDecl.getReturnType().getText();
                    }
                    catch {
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
        }
        catch {
            // Strategy A failed, fall through to B
        }
        // Strategy B: find service class via constructor type name
        try {
            const classDecl = method.getParent();
            if (!Node.isClassDeclaration(classDecl))
                continue;
            const ctor = classDecl.getConstructors()[0];
            if (!ctor)
                continue;
            let serviceTypeName;
            for (const ctorParam of ctor.getParameters()) {
                if (ctorParam.getName() === fieldName) {
                    serviceTypeName = ctorParam.getTypeNode()?.getText();
                    break;
                }
            }
            if (!serviceTypeName)
                continue;
            for (const sourceFile of project.getSourceFiles()) {
                for (const cls of sourceFile.getClasses()) {
                    if (cls.getName() === serviceTypeName) {
                        const targetMethod = cls.getMethod(calledMethodName);
                        if (targetMethod) {
                            const sourceCode = targetMethod.getText();
                            const returnTypeName = (() => {
                                try {
                                    return targetMethod.getReturnType().getText();
                                }
                                catch {
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
        }
        catch {
            // Strategy B failed
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
function buildMethodSignature(method) {
    const params = method
        .getParameters()
        .map((p) => p.getText())
        .join(", ");
    const returnType = (() => {
        try {
            return ": " + method.getReturnType().getText();
        }
        catch {
            const node = method.getReturnTypeNode();
            return node ? ": " + node.getText() : "";
        }
    })();
    return `${method.getName()}(${params})${returnType}`;
}
export function parseNestJSProject(projectRoot) {
    const tsconfigPath = path.join(projectRoot, "tsconfig.json");
    if (!fs.existsSync(tsconfigPath)) {
        throw new Error(`tsconfig.json not found at: ${tsconfigPath}`);
    }
    const project = new Project({
        tsConfigFilePath: tsconfigPath,
        skipAddingFilesFromTsConfig: false,
    });
    project.addSourceFilesFromTsConfig(tsconfigPath);
    const endpoints = [];
    for (const sourceFile of project.getSourceFiles()) {
        const filePath = sourceFile.getFilePath();
        if (filePath.includes("node_modules"))
            continue;
        for (const cls of sourceFile.getClasses()) {
            const isController = cls
                .getDecorators()
                .some((d) => d.getName() === "Controller");
            if (!isController)
                continue;
            const controllerClass = cls.getName() ?? "UnknownController";
            const basePath = getControllerBasePath(cls);
            for (const method of cls.getMethods()) {
                const httpInfo = getHttpMethodAndPath(method);
                if (!httpInfo)
                    continue;
                const { httpMethod, routePath: subPath } = httpInfo;
                const fullPath = normalizePath(basePath, subPath);
                const params = extractParams(method);
                const authContext = extractAuthContext(cls, method);
                const existingSwagger = extractExistingSwagger(cls, method);
                const { result: tracedService, reason: traceFailureReason } = traceServiceMethod(method, project);
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
                    authContext,
                    existingSwagger,
                });
            }
        }
    }
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
}
catch (err) {
    console.error("Parse error:", err);
    process.exit(1);
}
