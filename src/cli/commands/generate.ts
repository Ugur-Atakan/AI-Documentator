import * as path from "path";
import * as fs from "fs";
import chalk from "chalk";
import { execSync } from "child_process";
import { loadTasks } from "../../nodes/task-loader.js";
import { executeParallel } from "../../executor/parallel-executor.js";
import { printBanner, printConfig, printEndpointPreview, printSummary } from "../ui.js";
import { resolveConfig } from "../config-loader.js";
import { loadFailedEndpointIds, filterToFailed } from "../../executor/retry-store.js";

export interface GenerateOptions {
  project?: string;
  outputDir?: string;
  module?: string[];
  concurrency?: string;
  model?: string;
  dryRun?: boolean;
  noSkip?: boolean;
  retry?: boolean;
}

export async function generateCommand(opts: GenerateOptions): Promise<void> {
  printBanner();

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

  // ── Step 1: Parse ───────────────────────────────────────────────────────
  console.log("  Step 1: Parsing NestJS project...\n");
  const parsedOutputPath = path.join(process.cwd(), ".documentator_cache.json");

  try {
    const parserScript = path.join(
      path.dirname(new URL(import.meta.url).pathname),
      "..",
      "..",
      "parser",
      "nestjs-parser.ts"
    );
    const tsxBin = path.join(process.cwd(), "node_modules", ".bin", "tsx");
    execSync(
      `"${tsxBin}" "${parserScript}" --project "${config.project}" > "${parsedOutputPath}"`,
      { stdio: ["inherit", "pipe", "pipe"] }
    );
  } catch {
    console.error("  Parser failed. Is the project a valid NestJS project with tsconfig.json?");
    process.exit(1);
  }

  // ── Step 2: Load & filter ─────────────────────────────────────────────
  let { taskQueue, prismaSchema } = loadTasks(parsedOutputPath);

  // Retry mode: only process previously failed endpoints
  if (opts.retry) {
    const failedIds = loadFailedEndpointIds();
    if (!failedIds || failedIds.length === 0) {
      console.log(chalk.green("  No failed endpoints to retry. All clear!\n"));
      return;
    }
    taskQueue = filterToFailed(taskQueue, failedIds);
    console.log(chalk.yellow(`  Retry mode: ${taskQueue.length} previously failed endpoints\n`));
  }

  // Module filter
  if (config.modules?.length) {
    taskQueue = taskQueue.filter((t) =>
      config.modules!.some((mod) =>
        t.endpoint.controllerFilePath.toLowerCase().includes(mod.toLowerCase())
      )
    );
  }

  if (taskQueue.length === 0) {
    console.log("  No endpoints matched. Check --module filter.\n");
    return;
  }

  printConfig({
    project: config.project,
    outputDir: config.outputDir,
    dryRun: config.dryRun,
    skipExisting: config.skipExisting,
    modules: config.modules,
    model: config.model,
    concurrency: config.concurrency,
    endpointCount: taskQueue.length,
  });

  printEndpointPreview(taskQueue.slice(0, 30));
  if (taskQueue.length > 30) {
    console.log(`    ... and ${taskQueue.length - 30} more\n`);
  }

  // ── Step 3: Generate ──────────────────────────────────────────────────
  console.log("  Step 2: Generating documentation...\n");

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

  // Cleanup cache
  try { fs.unlinkSync(parsedOutputPath); } catch {}
}
