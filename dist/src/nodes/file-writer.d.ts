import type { EndpointTask, GeneratedDocs } from "../types/endpoint.js";
import type { ConsolidatedOutput, ControllerGroup } from "../types/controller-group.js";
export interface FileWriterOptions {
    /** If set, all output goes to this directory instead of next to the controller. */
    outputDir?: string;
    /** Print to stdout instead of writing files (safe preview mode) */
    dryRun?: boolean;
    /** Skip generation if the output file already exists */
    skipExisting?: boolean;
}
export declare function writeGeneratedDocs(task: EndpointTask, docs: GeneratedDocs, options?: FileWriterOptions): string[];
/**
 * Writes consolidated per-controller output files.
 * New pipeline: one file per type per controller instead of per endpoint.
 *
 * Output structure (with outputDir):
 *   {outputDir}/{module}/dto/{controller-kebab}.request.dto.ts
 *   {outputDir}/{module}/dto/{controller-kebab}.response.dto.ts
 *   {outputDir}/{module}/dto/{controller-kebab}.enums.ts
 *   {outputDir}/{module}/decorators/{controller-kebab}.decorators.ts
 *
 * Output structure (without outputDir — next to controller):
 *   {controllerDir}/dto/{controller-kebab}.request.dto.ts
 *   {controllerDir}/dto/{controller-kebab}.response.dto.ts
 *   {controllerDir}/dto/{controller-kebab}.enums.ts
 *   {controllerDir}/decorators/{controller-kebab}.decorators.ts
 */
export declare function writeConsolidatedDocs(group: ControllerGroup, output: ConsolidatedOutput, options?: FileWriterOptions): string[];
