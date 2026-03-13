import { select, input, confirm, checkbox } from "@inquirer/prompts";
import chalk from "chalk";
import * as fs from "fs";
import * as path from "path";
import { printBanner } from "./ui.js";
import { generateCommand } from "./commands/generate.js";
import { parseCommand } from "./commands/parse.js";
import { initCommand } from "./commands/init.js";
import { applyCommand } from "./commands/apply.js";
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

  // ── Pipeline mode ─────────────────────────────────────────────────────
  const pipeline = await select({
    message: "Pipeline mode:",
    choices: [
      {
        name: `Multi-agent  ${chalk.dim("per-controller, Planner + Writer (recommended)")}`,
        value: "multi-agent",
      },
      {
        name: `Legacy       ${chalk.dim("per-endpoint, single model")}`,
        value: "legacy",
      },
    ],
    default: "multi-agent",
  });

  const isLegacy = pipeline === "legacy";

  // ── Mode ────────────────────────────────────────────────────────────────
  const mode = await select({
    message: "Execution mode:",
    choices: [
      { name: `Dry-run     ${chalk.dim("preview only, no files written")}`, value: "dry-run" },
      { name: `Write       ${chalk.dim("generate and write files")}`, value: "generate" },
    ],
  });

  // ── Concurrency ─────────────────────────────────────────────────────────
  const concurrency = await select({
    message: "Parallel API requests:",
    choices: [
      { name: `3       ${chalk.dim("safe, free tier")}`, value: "3" },
      { name: `5       ${chalk.dim("balanced")}`, value: "5" },
      { name: `10      ${chalk.dim("fast, paid tier")}`, value: "10" },
      { name: `15      ${chalk.dim("aggressive")}`, value: "15" },
    ],
    default: "5",
  });

  // ── Model selection ───────────────────────────────────────────────────
  let model = "gemini-2.5-flash";
  let plannerModel: string | undefined;
  let writerModel: string | undefined;

  if (isLegacy) {
    model = await select({
      message: "Gemini model:",
      choices: [
        { name: `gemini-2.5-flash   ${chalk.dim("fast")}`, value: "gemini-2.5-flash" },
        { name: `gemini-2.5-pro     ${chalk.dim("higher quality")}`, value: "gemini-2.5-pro" },
      ],
      default: "gemini-2.5-flash",
    });
  } else {
    plannerModel = await select({
      message: "Planner model (reasoning, schema design):",
      choices: [
        { name: `gemini-2.5-pro     ${chalk.dim("best reasoning (recommended)")}`, value: "gemini-2.5-pro" },
        { name: `gemini-2.5-flash   ${chalk.dim("faster, cheaper")}`, value: "gemini-2.5-flash" },
      ],
      default: "gemini-2.5-pro",
    });

    writerModel = await select({
      message: "Writer model (code generation from schema):",
      choices: [
        { name: `gemini-2.5-flash   ${chalk.dim("fast + cheap (recommended)")}`, value: "gemini-2.5-flash" },
        { name: `gemini-2.5-pro     ${chalk.dim("higher quality")}`, value: "gemini-2.5-pro" },
      ],
      default: "gemini-2.5-flash",
    });
  }

  // ── Summary & confirm ──────────────────────────────────────────────────
  console.log();
  const dim = chalk.dim;
  console.log(dim("  +" + "-".repeat(50)));
  console.log(`  ${dim("|")} ${dim("Project")}       ${resolvedProject}`);
  console.log(`  ${dim("|")} ${dim("Modules")}       ${selectedModules.length > 0 ? selectedModules.join(", ") : dim("all")}`);
  console.log(`  ${dim("|")} ${dim("Output")}        ${resolvedOutput ?? dim("next to controllers")}`);
  console.log(`  ${dim("|")} ${dim("Pipeline")}      ${pipeline}`);
  console.log(`  ${dim("|")} ${dim("Mode")}          ${mode === "dry-run" ? "dry-run" : "write"}`);
  console.log(`  ${dim("|")} ${dim("Concurrency")}   ${concurrency}`);
  if (isLegacy) {
    console.log(`  ${dim("|")} ${dim("Model")}         ${model}`);
  } else {
    console.log(`  ${dim("|")} ${dim("Planner")}       ${plannerModel}`);
    console.log(`  ${dim("|")} ${dim("Writer")}        ${writerModel}`);
  }
  console.log(dim("  +" + "-".repeat(50)));
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
    legacy: isLegacy,
    plannerModel,
    writerModel,
  });
}

async function interactiveRetry(): Promise<void> {
  const count = getFailedCount();
  console.log(chalk.dim(`  ${count} failed endpoints from last run.\n`));

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

async function interactiveApply(): Promise<void> {
  const project = await input({
    message: "NestJS project path:",
    default: "../vmh-server-v2",
    validate: (val) => {
      const resolved = path.resolve(val);
      return fs.existsSync(resolved) || `Not found: ${resolved}`;
    },
  });

  const resolvedProject = path.resolve(project);

  const modules = getAvailableModules(resolvedProject);
  let selectedModules: string[] = [];

  if (modules.length > 0) {
    const filterModules = await confirm({
      message: `${modules.length} modules found. Filter by specific modules?`,
      default: false,
    });

    if (filterModules) {
      selectedModules = await checkbox({
        message: "Select modules:",
        choices: modules.map((m) => ({ name: m, value: m })),
        pageSize: 15,
      });
    }
  }

  const mode = await select({
    message: "Apply mode:",
    choices: [
      { name: `Dry-run     ${chalk.dim("preview changes without modifying files")}`, value: "dry-run" },
      { name: `Write       ${chalk.dim("modify controller files")}`, value: "write" },
    ],
  });

  console.log();

  await applyCommand({
    project: resolvedProject,
    module: selectedModules.length > 0 ? selectedModules : undefined,
    write: mode === "write",
  });
}

export async function runInteractive(): Promise<void> {
  printBanner();

  const choices = [
    { name: `Generate    ${chalk.dim("Create DTOs and Swagger decorators")}`, value: "generate" },
  ];

  // Show retry option only if there are failed endpoints
  if (hasRetryFile()) {
    const count = getFailedCount();
    choices.push({
      name: `Retry       ${chalk.dim(`Re-run ${count} failed endpoints`)}`,
      value: "retry",
    });
  }

  choices.push(
    { name: `Apply       ${chalk.dim("Apply decorators and DTOs to controllers")}`, value: "apply" },
    { name: `Parse       ${chalk.dim("Analyze project endpoints")}`, value: "parse" },
    { name: `Init        ${chalk.dim("Create .documentator.json config")}`, value: "init" },
    { name: `Help        ${chalk.dim("Show CLI usage")}`, value: "help" },
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
    case "apply":
      await interactiveApply();
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
