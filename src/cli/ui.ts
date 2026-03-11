import chalk from "chalk";
import type { ExecutorResult } from "../executor/parallel-executor.js";
import type { EndpointTask } from "../types/endpoint.js";

export function printBanner(): void {
  console.log(`
${chalk.bold.cyan("    ╔═══════════════════════════════════════════════════╗")}
${chalk.bold.cyan("    ║")}  ${chalk.bold.white("AI")}${chalk.dim("-")}${chalk.bold.magenta("DOCUMENTATOR")}                              ${chalk.bold.cyan("║")}
${chalk.bold.cyan("    ║")}  ${chalk.dim("NestJS → DTO + Swagger · powered by Gemini")}      ${chalk.bold.cyan("║")}
${chalk.bold.cyan("    ╚═══════════════════════════════════════════════════╝")}
`);
}

export function printConfig(opts: {
  project: string;
  outputDir?: string;
  dryRun: boolean;
  skipExisting: boolean;
  modules?: string[];
  model: string;
  concurrency: number;
  endpointCount: number;
}): void {
  const ln = (label: string, value: string) =>
    `  ${chalk.dim("│")} ${chalk.bold(label.padEnd(14))} ${value}`;

  console.log(chalk.dim("  ┌─────────────────────────────────────────────────┐"));
  console.log(ln("Project", chalk.white(opts.project)));
  console.log(ln("Output", opts.outputDir ? chalk.white(opts.outputDir) : chalk.dim("(next to controllers)")));
  console.log(ln("Mode", opts.dryRun ? chalk.yellow("DRY-RUN") : chalk.green("WRITE")));
  console.log(ln("Skip existing", opts.skipExisting ? chalk.green("yes") : chalk.yellow("no")));
  console.log(ln("Modules", opts.modules?.length ? chalk.white(opts.modules.join(", ")) : chalk.dim("all")));
  console.log(ln("Model", chalk.white(opts.model)));
  console.log(ln("Concurrency", chalk.white(String(opts.concurrency))));
  console.log(ln("Endpoints", chalk.bold.white(String(opts.endpointCount))));
  console.log(chalk.dim("  └─────────────────────────────────────────────────┘"));
  console.log();
}

export function printEndpointPreview(tasks: EndpointTask[]): void {
  console.log(chalk.bold("  Endpoints to document:\n"));

  for (const task of tasks) {
    const ep = task.endpoint;
    const method = methodColor(ep.httpMethod);
    const auth = authBadge(ep);
    const traced = ep.tracedService
      ? chalk.dim(`→ ${ep.tracedService.serviceClassName}.${ep.tracedService.methodName}`)
      : chalk.red.dim("(not traced)");

    console.log(`    ${auth} ${method} ${chalk.white(ep.routePath.padEnd(42))} ${traced}`);
  }
  console.log();
}

export function printSummary(result: ExecutorResult): void {
  const sec = (result.durationMs / 1000).toFixed(1);

  console.log();
  console.log(chalk.bold.cyan("  ╔═══════════════════════════════════╗"));
  console.log(chalk.bold.cyan("  ║") + chalk.bold("       GENERATION COMPLETE          ") + chalk.bold.cyan("║"));
  console.log(chalk.bold.cyan("  ╚═══════════════════════════════════╝"));
  console.log();
  console.log(`    ${chalk.green("● Completed")}    ${chalk.bold(String(result.completed.length))}`);
  console.log(`    ${chalk.red("✖ Failed")}       ${chalk.bold(String(result.failed.length))}`);
  console.log(`    ${chalk.dim("◌ Skipped")}      ${chalk.bold(String(result.skipped.length))}`);
  console.log(`    ${chalk.cyan("◎ Files")}        ${chalk.bold(String(result.writtenFiles.length))}`);
  console.log(`    ${chalk.dim("⏱ Duration")}     ${chalk.bold(sec + "s")}`);

  if (result.failed.length > 0) {
    console.log();
    console.log(chalk.red.bold("  Failed endpoints:"));
    for (const t of result.failed) {
      console.log(`    ${chalk.red("✖")} ${methodColor(t.endpoint.httpMethod)} ${t.endpoint.routePath}`);
      console.log(`      ${chalk.dim(t.error?.slice(0, 120) ?? "unknown")}`);
    }
  }

  console.log();
}

// ── Helpers ───────────────────────────────────────────────────────────────

function methodColor(method: string): string {
  const c: Record<string, (s: string) => string> = {
    GET: chalk.cyan, POST: chalk.green, PUT: chalk.yellow,
    PATCH: chalk.magenta, DELETE: chalk.red,
  };
  return (c[method] ?? chalk.white)(method.padEnd(6));
}

function authBadge(ep: EndpointTask["endpoint"]): string {
  const { authContext } = ep;
  if (authContext.isPublic) return chalk.bgGreen.black(" PUB  ");
  if (authContext.requiredPermission) return chalk.bgMagenta.white(" CASL ");
  if (authContext.requiresContext) return chalk.bgYellow.black(" CTX  ");
  return chalk.bgBlue.white(" JWT  ");
}
