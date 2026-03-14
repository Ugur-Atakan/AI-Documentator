export interface ParseOptions {
    project?: string;
    output?: string;
}
export declare function parseCommand(opts: ParseOptions): Promise<void>;
