#!/usr/bin/env -S node --import tsx/esm
import "dotenv/config";
import { Command } from "commander";
import { generateCommand } from "./src/cli/commands/generate.js";
import { parseCommand } from "./src/cli/commands/parse.js";
import { initCommand } from "./src/cli/commands/init.js";
import { applyCommand } from "./src/cli/commands/apply.js";
import { runInteractive } from "./src/cli/interactive.js";
import { printBanner } from "./src/cli/ui.js";
// No args or just "documentator" → interactive mode
const hasSubcommand = process.argv.length > 2 &&
    !process.argv[2].startsWith("-") ||
    process.argv.includes("--help") ||
    process.argv.includes("-h") ||
    process.argv.includes("--version") ||
    process.argv.includes("-V");
if (!hasSubcommand) {
    runInteractive().catch((err) => {
        // Ctrl+C graceful exit
        if (err?.message?.includes("User force closed"))
            process.exit(0);
        console.error("Error:", err);
        process.exit(1);
    });
}
else {
    printBanner();
    const program = new Command();
    program
        .name("documentator")
        .description("AI-powered NestJS documentation generator — DTO + Swagger from source code")
        .version("2.0.0");
    program
        .command("generate")
        .alias("gen")
        .description("Generate DTOs and Swagger decorators for endpoints")
        .option("-p, --project <path>", "Path to NestJS project root")
        .option("-o, --output-dir <path>", "Output directory for generated files")
        .option("-m, --module <name...>", "Filter by module name (repeatable)")
        .option("-c, --concurrency <n>", "Max parallel requests", "5")
        .option("--model <name>", "Gemini model name (legacy mode)", "gemini-2.5-flash")
        .option("--planner-model <name>", "Planner model (multi-agent mode)")
        .option("--writer-model <name>", "Writer model (multi-agent mode)")
        .option("--dry-run", "Preview output without writing files")
        .option("--no-skip", "Re-generate even if files already exist")
        .option("--retry", "Re-run only previously failed endpoints")
        .option("--legacy", "Use legacy per-endpoint pipeline")
        .action(generateCommand);
    program
        .command("retry")
        .description("Re-run only the endpoints that failed in the last run")
        .option("-p, --project <path>", "Path to NestJS project root")
        .option("-o, --output-dir <path>", "Output directory for generated files")
        .option("-c, --concurrency <n>", "Max parallel requests", "5")
        .option("--model <name>", "Gemini model name", "gemini-2.5-flash")
        .option("--dry-run", "Preview output without writing files")
        .action((opts) => generateCommand({ ...opts, retry: true }));
    program
        .command("parse")
        .description("Parse a NestJS project and output endpoint JSON")
        .option("-p, --project <path>", "Path to NestJS project root")
        .option("-o, --output <path>", "Output JSON path")
        .action(parseCommand);
    program
        .command("apply")
        .description("Apply generated decorators and DTOs to controller files")
        .option("-p, --project <path>", "Path to NestJS project root")
        .option("-m, --module <name...>", "Filter by module name (repeatable)")
        .option("--write", "Actually modify controller files (default is dry-run)")
        .action(applyCommand);
    program
        .command("init")
        .description("Create a .documentator.json config file interactively")
        .action(initCommand);
    program.parse();
}
