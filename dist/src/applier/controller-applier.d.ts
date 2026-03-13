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
export declare function scanMatches(projectPath: string, modules?: string[]): ApplyMatch[];
export declare function applyToControllers(matches: ApplyMatch[], dryRun: boolean): ApplyResult;
