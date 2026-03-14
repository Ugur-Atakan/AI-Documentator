import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import chalk from "chalk";
import { printBanner } from "../ui.js";

const CONFIG_FILE = ".documentator.json";

function ask(rl: readline.Interface, question: string, defaultVal?: string): Promise<string> {
  const suffix = defaultVal ? chalk.dim(` (${defaultVal})`) : "";
  return new Promise((resolve) => {
    rl.question(`  ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultVal || "");
    });
  });
}

export async function initCommand(): Promise<void> {
  printBanner();

  const configPath = path.join(process.cwd(), CONFIG_FILE);

  if (fs.existsSync(configPath)) {
    console.log(chalk.yellow(`  ${CONFIG_FILE} already exists. Overwriting.\n`));
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(chalk.dim("  Answer the questions below to create your config.\n"));

  const project = await ask(rl, "NestJS project path", "../vmh-server-v2");
  const outputDir = await ask(rl, "Output directory", "./output");
  const model = await ask(rl, "Gemini model", "gemini-2.5-flash");
  const concurrency = await ask(rl, "Concurrency", "5");
  const modulesRaw = await ask(rl, "Modules to include (comma-separated, empty = all)", "");

  rl.close();

  const config: Record<string, unknown> = {
    project,
    outputDir,
    model,
    concurrency: parseInt(concurrency, 10),
    skipExisting: true,
  };

  if (modulesRaw) {
    config.modules = modulesRaw.split(",").map((m) => m.trim()).filter(Boolean);
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

  console.log();
  console.log(chalk.green(`  ✓ Config written to ${CONFIG_FILE}`));
  console.log(chalk.dim(`  Now run: ${chalk.white("documentator generate")}\n`));
}
