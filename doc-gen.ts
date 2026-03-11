import "dotenv/config";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";
import { loadTasks } from "./src/nodes/task-loader.js";
import { executeParallel } from "./src/executor/parallel-executor.js";
import { printBanner, printConfig, printEndpointPreview, printSummary } from "./src/cli/ui.js";
import type { DocGenConfig } from "./src/config.js";

function printUsage() {
  console.log(`
Usage: tsx doc-gen.ts --project <path> [options]

Required:
  --project <path>       Path to the NestJS project root

Output:
  --output-dir <path>    Write all generated files to this directory
  --dry-run              Print generated code to stdout, do not write files
  --no-skip-existing     Re-generate even if output files already exist

Filtering:
  --module <name>        Only process controllers matching this substring
                         (can be repeated: --module auth --module mailbox)

Performance:
  --concurrency <n>      Max parallel endpoint processing (default: 5)
  --model <name>         Gemini model (default: gemini-2.5-flash)

Advanced:
  --parsed-output <path> Path to save intermediate parsed_endpoints.json

Examples:
  tsx doc-gen.ts --project ../vmh-server-v2 --output-dir ./output --module mailbox --dry-run
  tsx doc-gen.ts --project ../vmh-server-v2 --output-dir ./output --concurrency 10
`);
}

interface CliArgs extends DocGenConfig {
  parsedOutput: string;
  concurrency: number;
}

function parseArgs(args: string[]): CliArgs {
  const projectIdx = args.indexOf("--project");
  if (projectIdx === -1 || !args[projectIdx + 1]) {
    printUsage();
    process.exit(1);
  }

  const project = path.resolve(args[projectIdx + 1]);

  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : undefined;
  };

  const modules: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--module" && args[i + 1]) modules.push(args[i + 1]);
  }

  return {
    project,
    outputDir: get("--output-dir") ? path.resolve(get("--output-dir")!) : undefined,
    dryRun: args.includes("--dry-run"),
    skipExisting: !args.includes("--no-skip-existing"),
    modules: modules.length > 0 ? modules : undefined,
    model: get("--model") ?? "gemini-2.5-flash",
    concurrency: parseInt(get("--concurrency") ?? "5", 10),
    parsedOutput: get("--parsed-output")
      ? path.resolve(get("--parsed-output")!)
      : path.join(process.cwd(), "parsed_endpoints.json"),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  printBanner();

  if (!fs.existsSync(args.project)) {
    console.error(`Project not found: ${args.project}`);
    process.exit(1);
  }

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("GOOGLE_API_KEY not set in .env");
    process.exit(1);
  }

  // ── Step 1: Parse ─────────────────────────────────────────────────────────
  console.log("  Step 1: Parsing NestJS project with ts-morph...\n");
  try {
    const parserScript = path.join(process.cwd(), "src/parser/nestjs-parser.ts");
    execSync(
      `./node_modules/.bin/tsx "${parserScript}" --project "${args.project}" > "${args.parsedOutput}"`,
      { stdio: ["inherit", "pipe", "inherit"] }
    );
  } catch (err) {
    console.error("Parser failed:", err);
    process.exit(1);
  }

  // ── Step 2: Load & filter ─────────────────────────────────────────────────
  let { taskQueue, prismaSchema } = loadTasks(args.parsedOutput);

  if (args.modules?.length) {
    taskQueue = taskQueue.filter((t) =>
      args.modules!.some((mod) =>
        t.endpoint.controllerFilePath.toLowerCase().includes(mod.toLowerCase())
      )
    );
  }

  if (taskQueue.length === 0) {
    console.log("  No endpoints to process. Exiting.\n");
    return;
  }

  printConfig({
    project: args.project,
    outputDir: args.outputDir,
    dryRun: args.dryRun ?? false,
    skipExisting: args.skipExisting ?? true,
    modules: args.modules,
    model: args.model ?? "gemini-2.5-flash",
    concurrency: args.concurrency,
    endpointCount: taskQueue.length,
  });

  printEndpointPreview(taskQueue.slice(0, 30));
  if (taskQueue.length > 30) {
    console.log(`    ... and ${taskQueue.length - 30} more\n`);
  }

  // ── Step 3: Parallel generation ───────────────────────────────────────────
  console.log("  Step 2: Generating documentation...\n");

  const result = await executeParallel(taskQueue, {
    concurrency: args.concurrency,
    model: args.model ?? "gemini-2.5-flash",
    apiKey,
    fullPrismaSchema: prismaSchema,
    writerOptions: {
      outputDir: args.outputDir,
      dryRun: args.dryRun ?? false,
      skipExisting: args.skipExisting ?? true,
    },
  });

  printSummary(result);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
