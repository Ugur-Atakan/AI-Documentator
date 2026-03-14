import * as fs from "fs";
import * as path from "path";
const CONFIG_FILE = ".documentator.json";
function loadFileConfig() {
    const configPath = path.join(process.cwd(), CONFIG_FILE);
    if (!fs.existsSync(configPath))
        return {};
    try {
        const raw = fs.readFileSync(configPath, "utf-8");
        return JSON.parse(raw);
    }
    catch {
        return {};
    }
}
/**
 * Merges file config (.documentator.json) with CLI flags.
 * CLI flags always take precedence over file config.
 */
export function resolveConfig(cliOpts) {
    const file = loadFileConfig();
    const project = cliOpts.project ?? file.project;
    if (!project) {
        console.error("No project specified. Use --project or create .documentator.json with `documentator init`.");
        process.exit(1);
    }
    // Build multi-model config from CLI flags or file config
    let models = file.models;
    if (cliOpts.plannerModel || cliOpts.writerModel) {
        models = {
            ...models,
            ...(cliOpts.plannerModel ? { planner: cliOpts.plannerModel } : {}),
            ...(cliOpts.writerModel ? { writer: cliOpts.writerModel } : {}),
        };
    }
    return {
        project: path.resolve(project),
        outputDir: cliOpts.outputDir
            ? path.resolve(cliOpts.outputDir)
            : file.outputDir
                ? path.resolve(file.outputDir)
                : undefined,
        dryRun: cliOpts.dryRun ?? false,
        skipExisting: cliOpts.noSkip ? false : (file.skipExisting ?? true),
        modules: cliOpts.module?.length ? cliOpts.module : file.modules,
        model: cliOpts.model ?? file.model ?? "gemini-2.5-flash",
        concurrency: cliOpts.concurrency
            ? parseInt(cliOpts.concurrency, 10)
            : file.concurrency ?? 5,
        models,
        legacy: cliOpts.legacy ?? file.legacy ?? false,
    };
}
