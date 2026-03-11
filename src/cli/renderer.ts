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

const SPINNER = [".", "..", "..."];
let frame = 0;

const DIM = chalk.dim;
const ACCENT = chalk.cyan;

function methodStr(method: string): string {
  return DIM(method.padEnd(7));
}

function statusTag(status: EndpointStatus): string {
  switch (status) {
    case "pending":  return DIM("       ");
    case "dto":      return ACCENT("dto    ");
    case "swagger":  return ACCENT("swagger");
    case "writing":  return ACCENT("write  ");
    case "done":     return DIM("done   ");
    case "failed":   return chalk.red("failed ");
    case "skipped":  return DIM("skip   ");
  }
}

function statusIcon(status: EndpointStatus): string {
  switch (status) {
    case "pending":  return DIM("  ");
    case "dto":
    case "swagger":
    case "writing":  return ACCENT(SPINNER[frame % SPINNER.length].padEnd(3));
    case "done":     return DIM("ok ");
    case "failed":   return chalk.red("x  ");
    case "skipped":  return DIM("-  ");
  }
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
    }, 200);
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

    // Progress bar — clean monochrome
    const pct = total > 0 ? (done + failed + skipped) / total : 0;
    const barWidth = 30;
    const filled = Math.round(pct * barWidth);
    const bar = ACCENT("=".repeat(filled)) + DIM("-".repeat(barWidth - filled));

    // Collect visible lines: recent done, active, pending peek
    const activeEps = this.endpoints.filter((e) =>
      ["dto", "swagger", "writing"].includes(e.status)
    );
    const recentDone = this.endpoints
      .filter((e) => e.status === "done" || e.status === "failed")
      .slice(-3);
    const pendingPeek = this.endpoints
      .filter((e) => e.status === "pending")
      .slice(0, 1);

    const epLines: string[] = [];

    for (const ep of recentDone) {
      epLines.push(`  ${statusIcon(ep.status)}${methodStr(ep.method)} ${DIM(truncate(ep.path, 36))} ${statusTag(ep.status)}`);
    }
    for (const ep of activeEps) {
      epLines.push(`  ${statusIcon(ep.status)}${methodStr(ep.method)} ${truncate(ep.path, 36)} ${statusTag(ep.status)}`);
    }
    for (const ep of pendingPeek) {
      epLines.push(`  ${statusIcon(ep.status)}${methodStr(ep.method)} ${DIM(truncate(ep.path, 36))}`);
    }

    if (remaining > pendingPeek.length) {
      epLines.push(DIM(`  + ${remaining - pendingPeek.length} more`));
    }

    // Build fixed-height output
    const lines: string[] = [
      "",
      `  [${bar}] ${Math.round(pct * 100)}% ${DIM("(" + elapsed + "s")}${DIM(")")}`,
      "",
      ...epLines,
    ];

    // Pad to fixed height
    while (lines.length < this.VISIBLE_LINES - 1) {
      lines.push("");
    }

    // Footer
    lines.push(DIM(`  ${done}/${total} done`) + (failed > 0 ? chalk.red(`  ${failed} failed`) : "") + (active > 0 ? ACCENT(`  ${active} active`) : ""));

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
