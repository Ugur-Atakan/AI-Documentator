import chalk from "chalk";
import type { ExecutorResult } from "../executor/parallel-executor.js";
import type { EndpointTask } from "../types/endpoint.js";

const ACCENT = chalk.cyan;
const DIM = chalk.dim;
const BOLD = chalk.bold;

export function printBanner(): void {
  const art = [
    " /$$$$$$   /$$$$$$   /$$$$$$  /$$   /$$  /$$      /$$  /$$$$$$$$  /$$   /$$  /$$$$$$$$  /$$$$$$  /$$$$$$$$  /$$$$$$   /$$$$$$  ",
    "| $$__  $$ /$$__  $$ /$$__  $$| $$  | $$ | $$$$  /$$$$| $$_____/ | $$$ | $$ |__  $$__//$$__  $$|__  $$__//$$__  $$ | $$__  $$",
    "| $$  \\ $$| $$  \\ $$| $$  \\__/| $$  | $$ | $$ $$/$$ $$| $$       | $$$$| $$    | $$  | $$  \\ $$   | $$  | $$  \\ $$ | $$  \\ $$",
    "| $$  | $$| $$  | $$| $$      | $$  | $$ | $$  $$$| $$| $$$$$    | $$ $$ $$    | $$  | $$$$$$$$   | $$  | $$  | $$ | $$$$$$/ ",
    "| $$  | $$| $$  | $$| $$      | $$  | $$ | $$\\  $ | $$| $$__/    | $$  $$$$    | $$  | $$__  $$   | $$  | $$  | $$ | $$__  $$",
    "| $$  | $$| $$  | $$| $$    $$| $$  | $$ | $$ \\/  | $$| $$       | $$\\  $$$    | $$  | $$  | $$   | $$  | $$  | $$ | $$  \\ $$",
    "| $$$$$$/|  $$$$$$/|  $$$$$$/|  $$$$$$/ | $$     | $$| $$$$$$$$ | $$ \\  $$    | $$  | $$  | $$   | $$  |  $$$$$$/ | $$  | $$",
    "|_______/  \\______/  \\______/  \\______/ |__/     |__/|________/ |__/  \\__/    |__/  |__/  |__/   |__/   \\______/  |__/  |__/",
  ];

  console.log();
  for (const line of art) {
    console.log(ACCENT(line));
  }
  console.log();
  console.log(DIM("                        NestJS DTO + Swagger generator · powered by Gemini"));
  console.log();
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
  pipelineMode?: string;
}): void {
  const ln = (label: string, value: string) =>
    `  ${DIM("|")} ${DIM(label.padEnd(14))} ${value}`;

  console.log(DIM("  +" + "-".repeat(50)));
  console.log(ln("Project", opts.project));
  console.log(ln("Output", opts.outputDir ?? DIM("next to controllers")));
  if (opts.pipelineMode) {
    console.log(ln("Pipeline", opts.pipelineMode));
  }
  console.log(ln("Mode", opts.dryRun ? chalk.yellow("dry-run") : "write"));
  console.log(ln("Skip existing", opts.skipExisting ? "yes" : "no"));
  console.log(ln("Modules", opts.modules?.length ? opts.modules.join(", ") : DIM("all")));
  console.log(ln("Model", opts.model));
  console.log(ln("Concurrency", String(opts.concurrency)));
  console.log(ln("Endpoints", BOLD(String(opts.endpointCount))));
  console.log(DIM("  +" + "-".repeat(50)));
  console.log();
}

export function printEndpointPreview(tasks: EndpointTask[]): void {
  for (const task of tasks) {
    const ep = task.endpoint;
    const method = methodStr(ep.httpMethod);
    const auth = authBadge(ep);
    const traced = ep.tracedService
      ? DIM(`-> ${ep.tracedService.serviceClassName}.${ep.tracedService.methodName}`)
      : chalk.red.dim("(not traced)");

    console.log(`    ${auth} ${method} ${ep.routePath.padEnd(40)} ${traced}`);
  }
  console.log();
}

export function printSummary(result: ExecutorResult): void {
  const sec = (result.durationMs / 1000).toFixed(1);

  console.log();
  console.log(DIM("  " + "-".repeat(40)));
  console.log(BOLD("  Done."));
  console.log();
  console.log(`    ${ACCENT(String(result.completed.length))} completed`);
  console.log(`    ${result.failed.length > 0 ? chalk.red(String(result.failed.length)) : DIM("0")} failed`);
  console.log(`    ${DIM(String(result.skipped.length))} skipped`);
  console.log(`    ${DIM(String(result.writtenFiles.length))} files written`);
  console.log(`    ${DIM(sec + "s")}`);

  if (result.failed.length > 0) {
    console.log();
    console.log(chalk.red("  Failed:"));
    for (const t of result.failed) {
      console.log(`    ${chalk.red("x")} ${methodStr(t.endpoint.httpMethod)} ${t.endpoint.routePath}`);
      console.log(`      ${DIM(t.error?.slice(0, 120) ?? "unknown")}`);
    }
  }

  console.log();
}

// -- helpers --

function methodStr(method: string): string {
  const colors: Record<string, (s: string) => string> = {
    GET: ACCENT, POST: chalk.green, PUT: chalk.yellow,
    PATCH: chalk.magenta, DELETE: chalk.red,
  };
  return (colors[method] ?? chalk.white)(method.padEnd(7));
}

function authBadge(ep: EndpointTask["endpoint"]): string {
  const { authContext } = ep;
  if (authContext.isPublic) return DIM("[pub]  ");
  if (authContext.requiredPermission) return DIM("[casl] ");
  if (authContext.requiresContext) return DIM("[ctx]  ");
  return DIM("[jwt]  ");
}
