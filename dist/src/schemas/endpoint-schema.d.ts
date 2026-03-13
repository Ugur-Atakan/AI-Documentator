import { z } from "zod";
export declare const ParsedParamSchema: z.ZodObject<{
    decorator: z.ZodEnum<["@Body", "@Param", "@Query", "@Headers"]>;
    name: z.ZodOptional<z.ZodString>;
    typeName: z.ZodString;
    isOptional: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    decorator: "@Body" | "@Param" | "@Query" | "@Headers";
    typeName: string;
    isOptional: boolean;
    name?: string | undefined;
}, {
    decorator: "@Body" | "@Param" | "@Query" | "@Headers";
    typeName: string;
    isOptional: boolean;
    name?: string | undefined;
}>;
export declare const TracedServiceMethodSchema: z.ZodObject<{
    serviceClassName: z.ZodString;
    methodName: z.ZodString;
    sourceCode: z.ZodString;
    returnTypeName: z.ZodString;
    prismaModelsReferenced: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    serviceClassName: string;
    methodName: string;
    sourceCode: string;
    returnTypeName: string;
    prismaModelsReferenced: string[];
}, {
    serviceClassName: string;
    methodName: string;
    sourceCode: string;
    returnTypeName: string;
    prismaModelsReferenced: string[];
}>;
export declare const AuthContextSchema: z.ZodObject<{
    isPublic: z.ZodBoolean;
    requiresBearerAuth: z.ZodBoolean;
    guards: z.ZodArray<z.ZodString, "many">;
    requiredPermission: z.ZodOptional<z.ZodObject<{
        action: z.ZodString;
        subject: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        action: string;
        subject: string;
    }, {
        action: string;
        subject: string;
    }>>;
    requiredRoles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    currentUserUsages: z.ZodArray<z.ZodString, "many">;
    requiresContext: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    isPublic: boolean;
    requiresBearerAuth: boolean;
    guards: string[];
    currentUserUsages: string[];
    requiresContext: boolean;
    requiredPermission?: {
        action: string;
        subject: string;
    } | undefined;
    requiredRoles?: string[] | undefined;
}, {
    isPublic: boolean;
    requiresBearerAuth: boolean;
    guards: string[];
    currentUserUsages: string[];
    requiresContext: boolean;
    requiredPermission?: {
        action: string;
        subject: string;
    } | undefined;
    requiredRoles?: string[] | undefined;
}>;
export declare const ExistingSwaggerSchema: z.ZodObject<{
    hasApiOperation: z.ZodBoolean;
    hasApiResponse: z.ZodBoolean;
    hasBearerAuthOnClass: z.ZodBoolean;
    hasApiTags: z.ZodBoolean;
    apiTags: z.ZodArray<z.ZodString, "many">;
    hasApiBody: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    hasApiOperation: boolean;
    hasApiResponse: boolean;
    hasBearerAuthOnClass: boolean;
    hasApiTags: boolean;
    apiTags: string[];
    hasApiBody: boolean;
}, {
    hasApiOperation: boolean;
    hasApiResponse: boolean;
    hasBearerAuthOnClass: boolean;
    hasApiTags: boolean;
    apiTags: string[];
    hasApiBody: boolean;
}>;
export declare const ParsedEndpointSchema: z.ZodObject<{
    id: z.ZodString;
    controllerClass: z.ZodString;
    controllerFilePath: z.ZodString;
    httpMethod: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
    routePath: z.ZodString;
    methodName: z.ZodString;
    methodSignature: z.ZodString;
    params: z.ZodArray<z.ZodObject<{
        decorator: z.ZodEnum<["@Body", "@Param", "@Query", "@Headers"]>;
        name: z.ZodOptional<z.ZodString>;
        typeName: z.ZodString;
        isOptional: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        decorator: "@Body" | "@Param" | "@Query" | "@Headers";
        typeName: string;
        isOptional: boolean;
        name?: string | undefined;
    }, {
        decorator: "@Body" | "@Param" | "@Query" | "@Headers";
        typeName: string;
        isOptional: boolean;
        name?: string | undefined;
    }>, "many">;
    controllerMethodCode: z.ZodString;
    tracedService: z.ZodNullable<z.ZodObject<{
        serviceClassName: z.ZodString;
        methodName: z.ZodString;
        sourceCode: z.ZodString;
        returnTypeName: z.ZodString;
        prismaModelsReferenced: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        serviceClassName: string;
        methodName: string;
        sourceCode: string;
        returnTypeName: string;
        prismaModelsReferenced: string[];
    }, {
        serviceClassName: string;
        methodName: string;
        sourceCode: string;
        returnTypeName: string;
        prismaModelsReferenced: string[];
    }>>;
    traceFailureReason: z.ZodOptional<z.ZodString>;
    authContext: z.ZodObject<{
        isPublic: z.ZodBoolean;
        requiresBearerAuth: z.ZodBoolean;
        guards: z.ZodArray<z.ZodString, "many">;
        requiredPermission: z.ZodOptional<z.ZodObject<{
            action: z.ZodString;
            subject: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            action: string;
            subject: string;
        }, {
            action: string;
            subject: string;
        }>>;
        requiredRoles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        currentUserUsages: z.ZodArray<z.ZodString, "many">;
        requiresContext: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        isPublic: boolean;
        requiresBearerAuth: boolean;
        guards: string[];
        currentUserUsages: string[];
        requiresContext: boolean;
        requiredPermission?: {
            action: string;
            subject: string;
        } | undefined;
        requiredRoles?: string[] | undefined;
    }, {
        isPublic: boolean;
        requiresBearerAuth: boolean;
        guards: string[];
        currentUserUsages: string[];
        requiresContext: boolean;
        requiredPermission?: {
            action: string;
            subject: string;
        } | undefined;
        requiredRoles?: string[] | undefined;
    }>;
    existingSwagger: z.ZodObject<{
        hasApiOperation: z.ZodBoolean;
        hasApiResponse: z.ZodBoolean;
        hasBearerAuthOnClass: z.ZodBoolean;
        hasApiTags: z.ZodBoolean;
        apiTags: z.ZodArray<z.ZodString, "many">;
        hasApiBody: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        hasApiOperation: boolean;
        hasApiResponse: boolean;
        hasBearerAuthOnClass: boolean;
        hasApiTags: boolean;
        apiTags: string[];
        hasApiBody: boolean;
    }, {
        hasApiOperation: boolean;
        hasApiResponse: boolean;
        hasBearerAuthOnClass: boolean;
        hasApiTags: boolean;
        apiTags: string[];
        hasApiBody: boolean;
    }>;
}, "strip", z.ZodTypeAny, {
    params: {
        decorator: "@Body" | "@Param" | "@Query" | "@Headers";
        typeName: string;
        isOptional: boolean;
        name?: string | undefined;
    }[];
    methodName: string;
    id: string;
    controllerClass: string;
    controllerFilePath: string;
    httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    routePath: string;
    methodSignature: string;
    controllerMethodCode: string;
    tracedService: {
        serviceClassName: string;
        methodName: string;
        sourceCode: string;
        returnTypeName: string;
        prismaModelsReferenced: string[];
    } | null;
    authContext: {
        isPublic: boolean;
        requiresBearerAuth: boolean;
        guards: string[];
        currentUserUsages: string[];
        requiresContext: boolean;
        requiredPermission?: {
            action: string;
            subject: string;
        } | undefined;
        requiredRoles?: string[] | undefined;
    };
    existingSwagger: {
        hasApiOperation: boolean;
        hasApiResponse: boolean;
        hasBearerAuthOnClass: boolean;
        hasApiTags: boolean;
        apiTags: string[];
        hasApiBody: boolean;
    };
    traceFailureReason?: string | undefined;
}, {
    params: {
        decorator: "@Body" | "@Param" | "@Query" | "@Headers";
        typeName: string;
        isOptional: boolean;
        name?: string | undefined;
    }[];
    methodName: string;
    id: string;
    controllerClass: string;
    controllerFilePath: string;
    httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    routePath: string;
    methodSignature: string;
    controllerMethodCode: string;
    tracedService: {
        serviceClassName: string;
        methodName: string;
        sourceCode: string;
        returnTypeName: string;
        prismaModelsReferenced: string[];
    } | null;
    authContext: {
        isPublic: boolean;
        requiresBearerAuth: boolean;
        guards: string[];
        currentUserUsages: string[];
        requiresContext: boolean;
        requiredPermission?: {
            action: string;
            subject: string;
        } | undefined;
        requiredRoles?: string[] | undefined;
    };
    existingSwagger: {
        hasApiOperation: boolean;
        hasApiResponse: boolean;
        hasBearerAuthOnClass: boolean;
        hasApiTags: boolean;
        apiTags: string[];
        hasApiBody: boolean;
    };
    traceFailureReason?: string | undefined;
}>;
export declare const ParserOutputSchema: z.ZodObject<{
    projectRoot: z.ZodString;
    parsedAt: z.ZodString;
    prismaSchemaPath: z.ZodNullable<z.ZodString>;
    prismaSchemaContent: z.ZodNullable<z.ZodString>;
    endpoints: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        controllerClass: z.ZodString;
        controllerFilePath: z.ZodString;
        httpMethod: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
        routePath: z.ZodString;
        methodName: z.ZodString;
        methodSignature: z.ZodString;
        params: z.ZodArray<z.ZodObject<{
            decorator: z.ZodEnum<["@Body", "@Param", "@Query", "@Headers"]>;
            name: z.ZodOptional<z.ZodString>;
            typeName: z.ZodString;
            isOptional: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            decorator: "@Body" | "@Param" | "@Query" | "@Headers";
            typeName: string;
            isOptional: boolean;
            name?: string | undefined;
        }, {
            decorator: "@Body" | "@Param" | "@Query" | "@Headers";
            typeName: string;
            isOptional: boolean;
            name?: string | undefined;
        }>, "many">;
        controllerMethodCode: z.ZodString;
        tracedService: z.ZodNullable<z.ZodObject<{
            serviceClassName: z.ZodString;
            methodName: z.ZodString;
            sourceCode: z.ZodString;
            returnTypeName: z.ZodString;
            prismaModelsReferenced: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            serviceClassName: string;
            methodName: string;
            sourceCode: string;
            returnTypeName: string;
            prismaModelsReferenced: string[];
        }, {
            serviceClassName: string;
            methodName: string;
            sourceCode: string;
            returnTypeName: string;
            prismaModelsReferenced: string[];
        }>>;
        traceFailureReason: z.ZodOptional<z.ZodString>;
        authContext: z.ZodObject<{
            isPublic: z.ZodBoolean;
            requiresBearerAuth: z.ZodBoolean;
            guards: z.ZodArray<z.ZodString, "many">;
            requiredPermission: z.ZodOptional<z.ZodObject<{
                action: z.ZodString;
                subject: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                action: string;
                subject: string;
            }, {
                action: string;
                subject: string;
            }>>;
            requiredRoles: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            currentUserUsages: z.ZodArray<z.ZodString, "many">;
            requiresContext: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            isPublic: boolean;
            requiresBearerAuth: boolean;
            guards: string[];
            currentUserUsages: string[];
            requiresContext: boolean;
            requiredPermission?: {
                action: string;
                subject: string;
            } | undefined;
            requiredRoles?: string[] | undefined;
        }, {
            isPublic: boolean;
            requiresBearerAuth: boolean;
            guards: string[];
            currentUserUsages: string[];
            requiresContext: boolean;
            requiredPermission?: {
                action: string;
                subject: string;
            } | undefined;
            requiredRoles?: string[] | undefined;
        }>;
        existingSwagger: z.ZodObject<{
            hasApiOperation: z.ZodBoolean;
            hasApiResponse: z.ZodBoolean;
            hasBearerAuthOnClass: z.ZodBoolean;
            hasApiTags: z.ZodBoolean;
            apiTags: z.ZodArray<z.ZodString, "many">;
            hasApiBody: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            hasApiOperation: boolean;
            hasApiResponse: boolean;
            hasBearerAuthOnClass: boolean;
            hasApiTags: boolean;
            apiTags: string[];
            hasApiBody: boolean;
        }, {
            hasApiOperation: boolean;
            hasApiResponse: boolean;
            hasBearerAuthOnClass: boolean;
            hasApiTags: boolean;
            apiTags: string[];
            hasApiBody: boolean;
        }>;
    }, "strip", z.ZodTypeAny, {
        params: {
            decorator: "@Body" | "@Param" | "@Query" | "@Headers";
            typeName: string;
            isOptional: boolean;
            name?: string | undefined;
        }[];
        methodName: string;
        id: string;
        controllerClass: string;
        controllerFilePath: string;
        httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        routePath: string;
        methodSignature: string;
        controllerMethodCode: string;
        tracedService: {
            serviceClassName: string;
            methodName: string;
            sourceCode: string;
            returnTypeName: string;
            prismaModelsReferenced: string[];
        } | null;
        authContext: {
            isPublic: boolean;
            requiresBearerAuth: boolean;
            guards: string[];
            currentUserUsages: string[];
            requiresContext: boolean;
            requiredPermission?: {
                action: string;
                subject: string;
            } | undefined;
            requiredRoles?: string[] | undefined;
        };
        existingSwagger: {
            hasApiOperation: boolean;
            hasApiResponse: boolean;
            hasBearerAuthOnClass: boolean;
            hasApiTags: boolean;
            apiTags: string[];
            hasApiBody: boolean;
        };
        traceFailureReason?: string | undefined;
    }, {
        params: {
            decorator: "@Body" | "@Param" | "@Query" | "@Headers";
            typeName: string;
            isOptional: boolean;
            name?: string | undefined;
        }[];
        methodName: string;
        id: string;
        controllerClass: string;
        controllerFilePath: string;
        httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        routePath: string;
        methodSignature: string;
        controllerMethodCode: string;
        tracedService: {
            serviceClassName: string;
            methodName: string;
            sourceCode: string;
            returnTypeName: string;
            prismaModelsReferenced: string[];
        } | null;
        authContext: {
            isPublic: boolean;
            requiresBearerAuth: boolean;
            guards: string[];
            currentUserUsages: string[];
            requiresContext: boolean;
            requiredPermission?: {
                action: string;
                subject: string;
            } | undefined;
            requiredRoles?: string[] | undefined;
        };
        existingSwagger: {
            hasApiOperation: boolean;
            hasApiResponse: boolean;
            hasBearerAuthOnClass: boolean;
            hasApiTags: boolean;
            apiTags: string[];
            hasApiBody: boolean;
        };
        traceFailureReason?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    projectRoot: string;
    parsedAt: string;
    prismaSchemaPath: string | null;
    prismaSchemaContent: string | null;
    endpoints: {
        params: {
            decorator: "@Body" | "@Param" | "@Query" | "@Headers";
            typeName: string;
            isOptional: boolean;
            name?: string | undefined;
        }[];
        methodName: string;
        id: string;
        controllerClass: string;
        controllerFilePath: string;
        httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        routePath: string;
        methodSignature: string;
        controllerMethodCode: string;
        tracedService: {
            serviceClassName: string;
            methodName: string;
            sourceCode: string;
            returnTypeName: string;
            prismaModelsReferenced: string[];
        } | null;
        authContext: {
            isPublic: boolean;
            requiresBearerAuth: boolean;
            guards: string[];
            currentUserUsages: string[];
            requiresContext: boolean;
            requiredPermission?: {
                action: string;
                subject: string;
            } | undefined;
            requiredRoles?: string[] | undefined;
        };
        existingSwagger: {
            hasApiOperation: boolean;
            hasApiResponse: boolean;
            hasBearerAuthOnClass: boolean;
            hasApiTags: boolean;
            apiTags: string[];
            hasApiBody: boolean;
        };
        traceFailureReason?: string | undefined;
    }[];
}, {
    projectRoot: string;
    parsedAt: string;
    prismaSchemaPath: string | null;
    prismaSchemaContent: string | null;
    endpoints: {
        params: {
            decorator: "@Body" | "@Param" | "@Query" | "@Headers";
            typeName: string;
            isOptional: boolean;
            name?: string | undefined;
        }[];
        methodName: string;
        id: string;
        controllerClass: string;
        controllerFilePath: string;
        httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        routePath: string;
        methodSignature: string;
        controllerMethodCode: string;
        tracedService: {
            serviceClassName: string;
            methodName: string;
            sourceCode: string;
            returnTypeName: string;
            prismaModelsReferenced: string[];
        } | null;
        authContext: {
            isPublic: boolean;
            requiresBearerAuth: boolean;
            guards: string[];
            currentUserUsages: string[];
            requiresContext: boolean;
            requiredPermission?: {
                action: string;
                subject: string;
            } | undefined;
            requiredRoles?: string[] | undefined;
        };
        existingSwagger: {
            hasApiOperation: boolean;
            hasApiResponse: boolean;
            hasBearerAuthOnClass: boolean;
            hasApiTags: boolean;
            apiTags: string[];
            hasApiBody: boolean;
        };
        traceFailureReason?: string | undefined;
    }[];
}>;
export declare const GeneratedDtosSchema: z.ZodObject<{
    requestDtoCode: z.ZodNullable<z.ZodString>;
    responseDtoCode: z.ZodString;
}, "strip", z.ZodTypeAny, {
    requestDtoCode: string | null;
    responseDtoCode: string;
}, {
    requestDtoCode: string | null;
    responseDtoCode: string;
}>;
export declare const GeneratedSwaggerSchema: z.ZodObject<{
    controllerDecorators: z.ZodString;
}, "strip", z.ZodTypeAny, {
    controllerDecorators: string;
}, {
    controllerDecorators: string;
}>;
