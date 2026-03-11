import * as path from "path";
import * as fs from "fs";
import chalk from "chalk";
import { printBanner } from "../ui.js";
import { resolveConfig } from "../config-loader.js";

export interface ParseOptions {
  project?: string;
  output?: string;
}

export async function parseCommand(opts: ParseOptions): Promise<void> {
  printBanner();

  const config = resolveConfig({ project: opts.project });
  const outputPath = opts.output
    ? path.resolve(opts.output)
    : path.join(process.cwd(), "parsed_endpoints.json");

  if (!fs.existsSync(config.project)) {
    console.error(`Project not found: ${config.project}`);
    process.exit(1);
  }

  console.log(`  Parsing: ${chalk.white(config.project)}`);
  console.log(`  Output:  ${chalk.white(outputPath)}\n`);

  const { execSync } = await import("child_process");
  const parserScript = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "..",
    "parser",
    "nestjs-parser.ts"
  );
  const tsxBin = path.join(process.cwd(), "node_modules", ".bin", "tsx");

  try {
    execSync(
      `"${tsxBin}" "${parserScript}" --project "${config.project}" > "${outputPath}"`,
      { stdio: ["inherit", "pipe", "inherit"] }
    );

    const data = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    const endpoints = data.endpoints ?? [];

    console.log(chalk.green(`  ✓ ${endpoints.length} endpoints parsed`));
    console.log(chalk.dim(`  → ${outputPath}\n`));

    // Quick stats
    const publicCount = endpoints.filter((e: any) => e.authContext?.isPublic).length;
    const contextCount = endpoints.filter((e: any) => e.authContext?.requiresContext).length;
    const caslCount = endpoints.filter((e: any) => e.authContext?.requiredPermission).length;
    const tracedCount = endpoints.filter((e: any) => e.tracedService).length;

    console.log(chalk.dim("  Stats:"));
    console.log(`    Public:    ${publicCount}`);
    console.log(`    JWT+CTX:   ${contextCount}`);
    console.log(`    CASL:      ${caslCount}`);
    console.log(`    Traced:    ${tracedCount}/${endpoints.length}`);
    console.log();
  } catch {
    console.error("  Parser failed. Check the project path and tsconfig.json.");
    process.exit(1);
  }
}
