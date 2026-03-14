export interface ApplyOptions {
    project?: string;
    module?: string[];
    write?: boolean;
}
export declare function applyCommand(opts: ApplyOptions): Promise<void>;
