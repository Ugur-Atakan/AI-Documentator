export interface ParsedParam {
    decorator: "@Body" | "@Param" | "@Query" | "@Headers";
    name?: string;
    typeName: string;
    isOptional: boolean;
}
export interface TracedServiceMethod {
    serviceClassName: string;
    methodName: string;
    sourceCode: string;
    returnTypeName: string;
    prismaModelsReferenced: string[];
}
/** Auth/authorization context extracted from decorators */
export interface AuthContext {
    isPublic: boolean;
    requiresBearerAuth: boolean;
    guards: string[];
    requiredPermission?: {
        action: string;
        subject: string;
    };
    requiredRoles?: string[];
    /** e.g. ['id'] from @CurrentUser('id'), ['full'] from @CurrentUser() */
    currentUserUsages: string[];
    /** true when @Context() decorator is used — provides workspaceId + mailboxId */
    requiresContext: boolean;
}
/** Swagger decorators already present on the class or method */
export interface ExistingSwagger {
    hasApiOperation: boolean;
    hasApiResponse: boolean;
    /** true if @ApiBearerAuth() is on the class level */
    hasBearerAuthOnClass: boolean;
    hasApiTags: boolean;
    apiTags: string[];
    hasApiBody: boolean;
}
export interface ParsedEndpoint {
    id: string;
    controllerClass: string;
    controllerFilePath: string;
    httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    routePath: string;
    methodName: string;
    methodSignature: string;
    params: ParsedParam[];
    controllerMethodCode: string;
    tracedService: TracedServiceMethod | null;
    traceFailureReason?: string;
    authContext: AuthContext;
    existingSwagger: ExistingSwagger;
}
export interface ParserOutput {
    projectRoot: string;
    parsedAt: string;
    prismaSchemaPath: string | null;
    prismaSchemaContent: string | null;
    endpoints: ParsedEndpoint[];
}
export interface GeneratedDocs {
    requestDtoCode: string | null;
    responseDtoCode: string;
    controllerDecorators: string;
    outputPaths: {
        requestDto: string | null;
        responseDto: string;
        decorators: string;
    };
}
export interface EndpointTask {
    endpoint: ParsedEndpoint;
    status: "pending" | "in_progress" | "completed" | "failed";
    result?: GeneratedDocs;
    error?: string;
}
