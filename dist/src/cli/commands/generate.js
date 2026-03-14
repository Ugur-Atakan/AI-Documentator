import * as path from "path";
import * as fs from "fs";
import chalk from "chalk";
import { execSync } from "child_process";
import { loadTasks } from "../../nodes/task-loader.js";
import { executeParallel, executeControllerParallel } from "../../executor/parallel-executor.js";
import { printConfig, printEndpointPreview, printSummary } from "../ui.js";
import { resolveConfig } from "../config-loader.js";
import { loadFailedEndpointIds, filterToFailed } from "../../executor/retry-store.js";
export async function generateCommand(opts) {
    const config = resolveConfig(opts);
    if (!fs.existsSync(config.project)) {
        console.error(`Project not found: ${config.project}`);
        process.exit(1);
    }
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error("GOOGLE_API_KEY not set in environment or .env");
        process.exit(1);
    }
    console.log(chalk.dim("  Parsing project...\n"));
    const parsedOutputPath = path.join(process.cwd(), ".documentator_cache.json");
    try {
        const parserScript = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "parser", "nestjs-parser.ts");
        const tsxBin = path.join(process.cwd(), "node_modules", ".bin", "tsx");
        execSync(`"${tsxBin}" "${parserScript}" --project "${config.project}" > "${parsedOutputPath}"`, { stdio: ["inherit", "pipe", "pipe"] });
    }
    catch {
        console.error("  Parser failed. Is the project a valid NestJS project with tsconfig.json?");
        process.exit(1);
    }
    // ── Step 2: Load & filter ─────────────────────────────────────────────
    let { taskQueue, prismaSchema } = loadTasks(parsedOutputPath);
    // Retry mode: only process previously failed endpoints
    if (opts.retry) {
        const failedIds = loadFailedEndpointIds();
        if (!failedIds || failedIds.length === 0) {
            console.log(chalk.dim("  No failed endpoints to retry.\n"));
            return;
        }
        taskQueue = filterToFailed(taskQueue, failedIds);
        console.log(chalk.dim(`  Retrying ${taskQueue.length} failed endpoints\n`));
    }
    // Module filter
    if (config.modules?.length) {
        taskQueue = taskQueue.filter((t) => config.modules.some((mod) => t.endpoint.controllerFilePath.toLowerCase().includes(mod.toLowerCase())));
    }
    if (taskQueue.length === 0) {
        console.log("  No endpoints matched. Check --module filter.\n");
        return;
    }
    const pipelineMode = config.legacy ? "legacy" : "multi-agent";
    printConfig({
        project: config.project,
        outputDir: config.outputDir,
        dryRun: config.dryRun,
        skipExisting: config.skipExisting,
        modules: config.modules,
        model: config.model,
        concurrency: config.concurrency,
        endpointCount: taskQueue.length,
        pipelineMode,
    });
    printEndpointPreview(taskQueue.slice(0, 30));
    if (taskQueue.length > 30) {
        console.log(`    ... and ${taskQueue.length - 30} more\n`);
    }
    console.log(chalk.dim(`  Generating (${pipelineMode} pipeline)...\n`));
    if (config.legacy) {
        // Legacy per-endpoint pipeline
        const result = await executeParallel(taskQueue, {
            concurrency: config.concurrency,
            model: config.model,
            apiKey,
            fullPrismaSchema: prismaSchema,
            writerOptions: {
                outputDir: config.outputDir,
                dryRun: config.dryRun,
                skipExisting: config.skipExisting,
            },
        });
        printSummary(result);
    }
    else {
        // New per-controller multi-agent pipeline
        const result = await executeControllerParallel(taskQueue, {
            concurrency: config.concurrency,
            apiKey,
            fullPrismaSchema: prismaSchema,
            writerOptions: {
                outputDir: config.outputDir,
                dryRun: config.dryRun,
                skipExisting: config.skipExisting,
            },
            models: config.models,
        });
        printControllerSummary(result);
    }
    // Cleanup cache
    try {
        fs.unlinkSync(parsedOutputPath);
    }
    catch { }
}
function printControllerSummary(result) {
    const dim = chalk.dim;
    const accent = chalk.cyan;
    console.log();
    console.log(dim("  " + "─".repeat(50)));
    console.log(`  ${accent(String(result.completed.length))} controllers completed, ${result.failed.length > 0 ? chalk.red(String(result.failed.length) + " failed") : dim("0 failed")}`);
    console.log(`  ${accent(String(result.endpointCount))} endpoints across ${result.controllerCount} controllers`);
    console.log(`  ${accent(String(result.writtenFiles.length))} files written`);
    console.log(`  ${dim("Duration:")} ${(result.durationMs / 1000).toFixed(1)}s`);
    if (result.failed.length > 0) {
        console.log();
        console.log(chalk.red("  Failed controllers:"));
        for (const f of result.failed) {
            console.log(chalk.red(`    ${f.group.controllerClass}: ${f.error?.slice(0, 80) ?? "unknown"}`));
        }
    }
    console.log();
}
