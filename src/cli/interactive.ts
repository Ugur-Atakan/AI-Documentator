import { select, input, confirm, checkbox } from "@inquirer/prompts";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { printBanner } from "./ui.js";
import { generateCommand } from "./commands/generate.js";
import { parseCommand } from "./commands/parse.js";
import { initCommand } from "./commands/init.js";
import { suggestOutputDirs } from "./suggest-output.js";
import { hasRetryFile, getFailedCount } from "../executor/retry-store.js";

function getAvailableModules(projectPath: string): string[] {
  const modulesDir = path.join(projectPath, "src", "modules");
  if (!fs.existsSync(modulesDir)) return [];

  return fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
}

async function interactiveGenerate(): Promise<void> {
  // ── Project path ────────────────────────────────────────────────────────
  const project = await input({
    message: "NestJS project path:",
    default: "../vmh-server-v2",
    validate: (val) => {
      const resolved = path.resolve(val);
      return fs.existsSync(resolved) || `Not found: ${resolved}`;
    },
  });

  const resolvedProject = path.resolve(project);

  // ── Module selection ────────────────────────────────────────────────────
  const modules = getAvailableModules(resolvedProject);
  let selectedModules: string[] = [];

  if (modules.length > 0) {
    const filterModules = await confirm({
      message: `${modules.length} modules found. Filter by specific modules?`,
      default: true,
    });

    if (filterModules) {
      selectedModules = await checkbox({
        message: "Select modules:",
        choices: modules.map((m) => ({ name: m, value: m })),
        pageSize: 15,
      });
    }
  }

  // ── Output dir (smart suggestions) ─────────────────────────────────────
  const suggestions = suggestOutputDirs(resolvedProject);

  const outputDir = await select({
    message: "Where to write generated files?",
    choices: [
      ...suggestions.map((s) => ({
        name: `${chalk.white(s.label)} ${chalk.dim("— " + s.reason)}`,
        value: s.path,
      })),
      { name: chalk.dim("Custom path..."), value: "__custom__" },
    ],
  });

  let finalOutputDir = outputDir;
  if (outputDir === "__custom__") {
    finalOutputDir = await input({ message: "Custom output directory:" });
  }
  const resolvedOutput = finalOutputDir ? path.resolve(finalOutputDir) : undefined;

  // ── Mode ────────────────────────────────────────────────────────────────
  const mode = await select({
    message: "Execution mode:",
    choices: [
      { name: `${chalk.yellow("◌ Dry-run")}   — preview only, no files written`, value: "dry-run" },
      { name: `${chalk.green("● Generate")}  — write files to output`, value: "generate" },
    ],
  });

  // ── Concurrency ─────────────────────────────────────────────────────────
  const concurrency = await select({
    message: "Parallel API requests:",
    choices: [
      { name: "3   safe (free tier)", value: "3" },
      { name: "5   balanced", value: "5" },
      { name: "10  fast (paid tier)", value: "10" },
      { name: "15  aggressive", value: "15" },
    ],
    default: "5",
  });

  // ── Model ───────────────────────────────────────────────────────────────
  const model = await select({
    message: "Gemini model:",
    choices: [
      { name: "gemini-2.5-flash   fast & cheap", value: "gemini-2.5-flash" },
      { name: "gemini-2.5-pro     higher quality", value: "gemini-2.5-pro" },
    ],
    default: "gemini-2.5-flash",
  });

  // ── Summary & confirm ──────────────────────────────────────────────────
  console.log();
  console.log(chalk.dim("  ┌─────────────────────────────────────────────────┐"));
  console.log(`  ${chalk.dim("│")} ${chalk.bold("Project")}       ${chalk.white(resolvedProject)}`);
  console.log(`  ${chalk.dim("│")} ${chalk.bold("Modules")}       ${selectedModules.length > 0 ? chalk.white(selectedModules.join(", ")) : chalk.dim("all")}`);
  console.log(`  ${chalk.dim("│")} ${chalk.bold("Output")}        ${resolvedOutput ? chalk.white(resolvedOutput) : chalk.dim("next to controllers")}`);
  console.log(`  ${chalk.dim("│")} ${chalk.bold("Mode")}          ${mode === "dry-run" ? chalk.yellow("dry-run") : chalk.green("generate")}`);
  console.log(`  ${chalk.dim("│")} ${chalk.bold("Concurrency")}   ${chalk.white(concurrency)}`);
  console.log(`  ${chalk.dim("│")} ${chalk.bold("Model")}         ${chalk.white(model)}`);
  console.log(chalk.dim("  └─────────────────────────────────────────────────┘"));
  console.log();

  const proceed = await confirm({ message: "Start?", default: true });
  if (!proceed) {
    console.log(chalk.dim("\n  Cancelled.\n"));
    return;
  }

  console.log();

  await generateCommand({
    project: resolvedProject,
    outputDir: resolvedOutput,
    module: selectedModules.length > 0 ? selectedModules : undefined,
    concurrency,
    model,
    dryRun: mode === "dry-run",
  });
}

async function interactiveRetry(): Promise<void> {
  const count = getFailedCount();
  console.log(chalk.yellow(`  ${count} endpoints failed in the last run.\n`));

  const project = await input({
    message: "NestJS project path:",
    default: "../vmh-server-v2",
    validate: (val) => {
      const resolved = path.resolve(val);
      return fs.existsSync(resolved) || `Not found: ${resolved}`;
    },
  });

  const suggestions = suggestOutputDirs(path.resolve(project));
  const outputDir = await select({
    message: "Where to write generated files?",
    choices: [
      ...suggestions.map((s) => ({
        name: `${chalk.white(s.label)} ${chalk.dim("— " + s.reason)}`,
        value: s.path,
      })),
      { name: chalk.dim("Custom path..."), value: "__custom__" },
    ],
  });

  let finalOutputDir = outputDir;
  if (outputDir === "__custom__") {
    finalOutputDir = await input({ message: "Custom output directory:" });
  }

  const concurrency = await select({
    message: "Parallel API requests:",
    choices: [
      { name: "3   safe", value: "3" },
      { name: "5   balanced", value: "5" },
      { name: "10  fast", value: "10" },
    ],
    default: "5",
  });

  const proceed = await confirm({ message: `Retry ${count} failed endpoints?`, default: true });
  if (!proceed) {
    console.log(chalk.dim("\n  Cancelled.\n"));
    return;
  }

  console.log();

  await generateCommand({
    project: path.resolve(project),
    outputDir: finalOutputDir ? path.resolve(finalOutputDir) : undefined,
    concurrency,
    retry: true,
  });
}

async function interactiveParse(): Promise<void> {
  const project = await input({
    message: "NestJS project path:",
    default: "../vmh-server-v2",
    validate: (val) => {
      const resolved = path.resolve(val);
      return fs.existsSync(resolved) || `Not found: ${resolved}`;
    },
  });

  const output = await input({
    message: "Output JSON path:",
    default: "./parsed_endpoints.json",
  });

  await parseCommand({ project: path.resolve(project), output: path.resolve(output) });
}

export async function runInteractive(): Promise<void> {
  printBanner();

  const choices = [
    { name: `${chalk.green("⚡ Generate")}   Create DTOs and Swagger decorators`, value: "generate" },
  ];

  // Show retry option only if there are failed endpoints
  if (hasRetryFile()) {
    const count = getFailedCount();
    choices.push({
      name: `${chalk.red("🔄 Retry")}      Re-run ${count} failed endpoints`,
      value: "retry",
    });
  }

  choices.push(
    { name: `${chalk.cyan("🔍 Parse")}      Analyze project endpoints`, value: "parse" },
    { name: `${chalk.yellow("⚙  Init")}       Create .documentator.json config`, value: "init" },
    { name: `${chalk.dim("❓ Help")}       Show CLI usage`, value: "help" },
  );

  const action = await select({
    message: "What would you like to do?",
    choices,
  });

  console.log();

  switch (action) {
    case "generate":
      await interactiveGenerate();
      break;
    case "retry":
      await interactiveRetry();
      break;
    case "parse":
      await interactiveParse();
      break;
    case "init":
      await initCommand();
      break;
    case "help":
      console.log(chalk.bold("  Usage:\n"));
      console.log(`    ${chalk.white("documentator")}              Interactive mode`);
      console.log(`    ${chalk.white("documentator --help")}       All commands & flags`);
      console.log(`    ${chalk.white("documentator init")}         Create config file`);
      console.log(`    ${chalk.white("documentator gen")}          Generate with flags`);
      console.log(`    ${chalk.white("documentator parse")}        Parse only\n`);
      break;
  }
}
