import logUpdate from "log-update";
import chalk from "chalk";

export type EndpointStatus = "pending" | "dto" | "swagger" | "writing" | "done" | "failed" | "skipped";

export interface EndpointLine {
  method: string;
  path: string;
  controller: string;
  status: EndpointStatus;
  error?: string;
}

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let frame = 0;

const METHOD_COLOR: Record<string, (s: string) => string> = {
  GET: chalk.cyan,
  POST: chalk.green,
  PUT: chalk.yellow,
  PATCH: chalk.magenta,
  DELETE: chalk.red,
};

function statusIcon(status: EndpointStatus): string {
  switch (status) {
    case "pending":  return chalk.gray("○");
    case "dto":      return chalk.cyan(SPINNER[frame % SPINNER.length]);
    case "swagger":  return chalk.blue(SPINNER[frame % SPINNER.length]);
    case "writing":  return chalk.yellow(SPINNER[frame % SPINNER.length]);
    case "done":     return chalk.green("●");
    case "failed":   return chalk.red("✖");
    case "skipped":  return chalk.dim("◌");
  }
}

function statusLabel(status: EndpointStatus): string {
  switch (status) {
    case "pending":  return chalk.gray("waiting");
    case "dto":      return chalk.cyan("generating DTOs");
    case "swagger":  return chalk.blue("generating Swagger");
    case "writing":  return chalk.yellow("writing files");
    case "done":     return chalk.green("done");
    case "failed":   return chalk.red("failed");
    case "skipped":  return chalk.dim("skipped");
  }
}

function methodStr(method: string): string {
  return (METHOD_COLOR[method] ?? chalk.white)(method.padEnd(7));
}

/**
 * Fixed-height terminal renderer using log-update.
 * Always outputs exactly VISIBLE_LINES lines so log-update
 * can overwrite cleanly without stacking/duplication.
 */
export class Renderer {
  private endpoints: EndpointLine[] = [];
  private interval: ReturnType<typeof setInterval> | null = null;
  private startTime = Date.now();

  /** Total lines the render block occupies — never changes mid-run */
  private readonly VISIBLE_LINES = 15;

  start(endpoints: EndpointLine[]): void {
    this.endpoints = endpoints;
    this.startTime = Date.now();
    this.render();
    this.interval = setInterval(() => {
      frame++;
      this.render();
    }, 80);
  }

  update(index: number, status: EndpointStatus, error?: string): void {
    if (this.endpoints[index]) {
      this.endpoints[index].status = status;
      if (error) this.endpoints[index].error = error;
    }
  }

  private render(): void {
    const done = this.endpoints.filter((e) => e.status === "done").length;
    const failed = this.endpoints.filter((e) => e.status === "failed").length;
    const skipped = this.endpoints.filter((e) => e.status === "skipped").length;
    const active = this.endpoints.filter((e) =>
      ["dto", "swagger", "writing"].includes(e.status)
    ).length;
    const total = this.endpoints.length;
    const remaining = total - done - failed - skipped - active;
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);

    // Progress bar
    const pct = total > 0 ? (done + failed + skipped) / total : 0;
    const barWidth = 30;
    const filled = Math.round(pct * barWidth);
    const bar =
      chalk.cyan("█".repeat(filled)) +
      chalk.gray("░".repeat(barWidth - filled));

    // Collect visible endpoint lines: active first, then last few done, then pending peek
    const activeEps = this.endpoints.filter((e) =>
      ["dto", "swagger", "writing"].includes(e.status)
    );
    const recentDone = this.endpoints
      .filter((e) => e.status === "done" || e.status === "failed")
      .slice(-3);
    const pendingPeek = this.endpoints
      .filter((e) => e.status === "pending")
      .slice(0, 2);

    const epLines: string[] = [];

    for (const ep of recentDone) {
      epLines.push(
        `  ${statusIcon(ep.status)} ${methodStr(ep.method)} ${chalk.dim(truncate(ep.path, 38))} ${statusLabel(ep.status)}`
      );
    }
    for (const ep of activeEps) {
      epLines.push(
        `  ${statusIcon(ep.status)} ${methodStr(ep.method)} ${chalk.white(truncate(ep.path, 38))} ${statusLabel(ep.status)}`
      );
    }
    for (const ep of pendingPeek) {
      epLines.push(
        `  ${statusIcon(ep.status)} ${methodStr(ep.method)} ${chalk.gray(truncate(ep.path, 38))} ${statusLabel(ep.status)}`
      );
    }

    if (remaining > pendingPeek.length) {
      epLines.push(chalk.gray(`  ... ${remaining - pendingPeek.length} more waiting`));
    }

    // Build fixed-height output
    const lines: string[] = [
      "",
      `  ${bar} ${chalk.bold(Math.round(pct * 100) + "%")} ${chalk.dim(`(${elapsed}s)`)}`,
      "",
      ...epLines,
    ];

    // Pad to fixed height
    while (lines.length < this.VISIBLE_LINES - 2) {
      lines.push("");
    }

    // Footer (always last 2 lines)
    lines.push(chalk.dim("  ─".repeat(25)));
    lines.push(
      `  ${chalk.green("● " + done)} done  ${chalk.red("✖ " + failed)} failed  ${chalk.cyan("⠹ " + active)} active  ${chalk.gray("○ " + remaining)} pending`
    );

    logUpdate(lines.join("\n"));
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    frame++;
    this.render();
    logUpdate.done();
  }

  getStats(): { done: number; failed: number; skipped: number; elapsed: number } {
    return {
      done: this.endpoints.filter((e) => e.status === "done").length,
      failed: this.endpoints.filter((e) => e.status === "failed").length,
      skipped: this.endpoints.filter((e) => e.status === "skipped").length,
      elapsed: Date.now() - this.startTime,
    };
  }

  getFailedEndpoints(): EndpointLine[] {
    return this.endpoints.filter((e) => e.status === "failed");
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str.padEnd(max);
}
