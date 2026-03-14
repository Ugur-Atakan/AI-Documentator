import type { ParsedEndpoint } from "./endpoint.js";
/** A group of endpoints belonging to the same controller */
export interface ControllerGroup {
    controllerClass: string;
    controllerFilePath: string;
    moduleName: string;
    endpoints: ParsedEndpoint[];
}
/** Consolidated output for a single controller — all DTOs/decorators in one file each */
export interface ConsolidatedOutput {
    controllerClass: string;
    moduleName: string;
    requestDtoCode: string | null;
    responseDtoCode: string | null;
    enumsCode: string | null;
    decoratorsCode: string;
    outputPaths: {
        requestDto: string | null;
        responseDto: string | null;
        enums: string | null;
        decorators: string;
    };
}
/** Tracks a controller through the multi-agent pipeline */
export interface ControllerTask {
    group: ControllerGroup;
    status: "pending" | "analyzing" | "planning" | "generating" | "reviewing" | "writing" | "completed" | "failed";
    result?: ConsolidatedOutput;
    error?: string;
}
/** Structured plan output from the Planner agent */
export interface DocumentationPlan {
    controllerClass: string;
    sharedEnums: SharedEnumPlan[];
    endpoints: EndpointPlan[];
}
export interface SharedEnumPlan {
    name: string;
    values: string[];
    description: string;
}
export interface EndpointPlan {
    methodName: string;
    httpMethod: string;
    routePath: string;
    requestDto: DtoPlan | null;
    responseDto: DtoPlan;
    decorators: DecoratorPlan;
}
export interface DtoPlan {
    className: string;
    fields: FieldPlan[];
    extendsClass?: string;
}
export interface FieldPlan {
    name: string;
    type: string;
    isOptional: boolean;
    isArray: boolean;
    validators: string[];
    description: string;
    example: string;
    enumName?: string;
}
export interface DecoratorPlan {
    summary: string;
    description?: string;
    responses: ResponsePlan[];
    params: ParamPlan[];
    queries: ParamPlan[];
    needsBearerAuth: boolean;
    needsApiBody: boolean;
}
export interface ResponsePlan {
    status: number;
    description: string;
    type?: string;
}
export interface ParamPlan {
    name: string;
    type: string;
    required: boolean;
    description: string;
}
/** Result from the rule-based reviewer */
export interface ReviewResult {
    passed: boolean;
    issues: ReviewIssue[];
}
export interface ReviewIssue {
    severity: "error" | "warning";
    message: string;
    file: "requestDto" | "responseDto" | "enums" | "decorators";
    line?: number;
}
/** Project-level analysis result (cached across controllers) */
export interface ProjectAnalysis {
    framework: string;
    hasSharedDtos: boolean;
    sharedDtoPath?: string;
    existingPatterns: string[];
    conventionNotes: string[];
}
