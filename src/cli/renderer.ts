import logUpdate from "log-update";
import chalk from "chalk";

// ── Legacy endpoint-based statuses ──────────────────────────────────────────
export type EndpointStatus = "pending" | "dto" | "swagger" | "writing" | "done" | "failed" | "skipped";

export interface EndpointLine {
  method: string;
  path: string;
  controller: string;
  status: EndpointStatus;
  error?: string;
}

// ── New controller-based statuses ───────────────────────────────────────────
export type ControllerStatus =
  | "pending"
  | "analyzing"
  | "planning"
  | "generating"
  | "reviewing"
  | "writing"
  | "done"
  | "failed"
  | "skipped";

export interface ControllerLine {
  controllerClass: string;
  endpointCount: number;
  status: ControllerStatus;
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

function controllerStatusTag(status: ControllerStatus): string {
  switch (status) {
    case "pending":    return DIM("pending    ");
    case "analyzing":  return ACCENT("analyzing  ");
    case "planning":   return ACCENT("planning   ");
    case "generating": return ACCENT("generating ");
    case "reviewing":  return ACCENT("reviewing  ");
    case "writing":    return ACCENT("writing    ");
    case "done":       return DIM("done       ");
    case "failed":     return chalk.red("failed     ");
    case "skipped":    return DIM("skipped    ");
  }
}

function statusIcon(status: EndpointStatus | ControllerStatus): string {
  switch (status) {
    case "pending":    return DIM("  ");
    case "dto":
    case "swagger":
    case "writing":
    case "analyzing":
    case "planning":
    case "generating":
    case "reviewing":  return ACCENT(SPINNER[frame % SPINNER.length].padEnd(3));
    case "done":       return DIM("ok ");
    case "failed":     return chalk.red("x  ");
    case "skipped":    return DIM("-  ");
  }
}

/**
 * Fixed-height terminal renderer using log-update.
 * Supports both legacy endpoint-based and new controller-based modes.
 */
export class Renderer {
  private endpoints: EndpointLine[] = [];
  private controllers: ControllerLine[] = [];
  private mode: "endpoint" | "controller" = "endpoint";
  private interval: ReturnType<typeof setInterval> | null = null;
  private startTime = Date.now();

  /** Total lines the render block occupies — never changes mid-run */
  private readonly VISIBLE_LINES = 15;

  // ── Endpoint mode (legacy) ──────────────────────────────────────────────

  start(endpoints: EndpointLine[]): void {
    this.endpoints = endpoints;
    this.mode = "endpoint";
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

  // ── Controller mode (new) ───────────────────────────────────────────────

  startControllers(controllers: ControllerLine[]): void {
    this.controllers = controllers;
    this.mode = "controller";
    this.startTime = Date.now();
    this.render();
    this.interval = setInterval(() => {
      frame++;
      this.render();
    }, 200);
  }

  updateController(index: number, status: ControllerStatus, error?: string): void {
    if (this.controllers[index]) {
      this.controllers[index].status = status;
      if (error) this.controllers[index].error = error;
    }
  }

  // ── Shared ──────────────────────────────────────────────────────────────

  private render(): void {
    if (this.mode === "controller") {
      this.renderControllers();
    } else {
      this.renderEndpoints();
    }
  }

  private renderEndpoints(): void {
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
    const bar = ACCENT("=".repeat(filled)) + DIM("-".repeat(barWidth - filled));

    // Collect visible lines
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

  private renderControllers(): void {
    const done = this.controllers.filter((c) => c.status === "done").length;
    const failed = this.controllers.filter((c) => c.status === "failed").length;
    const skipped = this.controllers.filter((c) => c.status === "skipped").length;
    const activeStatuses: ControllerStatus[] = ["analyzing", "planning", "generating", "reviewing", "writing"];
    const active = this.controllers.filter((c) =>
      activeStatuses.includes(c.status)
    ).length;
    const total = this.controllers.length;
    const remaining = total - done - failed - skipped - active;
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);

    const totalEndpoints = this.controllers.reduce((s, c) => s + c.endpointCount, 0);

    // Progress bar
    const pct = total > 0 ? (done + failed + skipped) / total : 0;
    const barWidth = 30;
    const filled = Math.round(pct * barWidth);
    const bar = ACCENT("=".repeat(filled)) + DIM("-".repeat(barWidth - filled));

    // Controller lines
    const activeControllers = this.controllers.filter((c) =>
      activeStatuses.includes(c.status)
    );
    const recentDone = this.controllers
      .filter((c) => c.status === "done" || c.status === "failed")
      .slice(-2);
    const pendingPeek = this.controllers
      .filter((c) => c.status === "pending")
      .slice(0, 1);

    const ctrlLines: string[] = [];

    for (const c of recentDone) {
      const name = truncate(c.controllerClass, 28).padEnd(28);
      const epCount = DIM(`(${c.endpointCount} endpoints)`);
      ctrlLines.push(`  ${statusIcon(c.status)}${DIM(name)} ${controllerStatusTag(c.status)} ${epCount}`);
    }
    for (const c of activeControllers) {
      const name = truncate(c.controllerClass, 28).padEnd(28);
      const epCount = DIM(`(${c.endpointCount} endpoints)`);
      ctrlLines.push(`  ${statusIcon(c.status)}${name} ${controllerStatusTag(c.status)} ${epCount}`);
    }
    for (const c of pendingPeek) {
      const name = truncate(c.controllerClass, 28).padEnd(28);
      ctrlLines.push(`  ${statusIcon(c.status)}${DIM(name)}`);
    }

    if (remaining > pendingPeek.length) {
      ctrlLines.push(DIM(`  + ${remaining - pendingPeek.length} more`));
    }

    // Build fixed-height output
    const lines: string[] = [
      "",
      `  [${bar}] ${Math.round(pct * 100)}% ${DIM("(" + elapsed + "s")}${DIM(")")}`,
      "",
      ...ctrlLines,
    ];

    while (lines.length < this.VISIBLE_LINES - 1) {
      lines.push("");
    }

    // Footer
    const footerParts = [
      `${done}/${total} controllers`,
      `${totalEndpoints} endpoints`,
    ];
    if (failed > 0) footerParts.push(chalk.red(`${failed} failed`));
    footerParts.push(`${elapsed}s elapsed`);

    lines.push(DIM("  " + footerParts.join("  ·  ")));

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
    if (this.mode === "controller") {
      return {
        done: this.controllers.filter((c) => c.status === "done").length,
        failed: this.controllers.filter((c) => c.status === "failed").length,
        skipped: this.controllers.filter((c) => c.status === "skipped").length,
        elapsed: Date.now() - this.startTime,
      };
    }
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

  getFailedControllers(): ControllerLine[] {
    return this.controllers.filter((c) => c.status === "failed");
  }
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str.padEnd(max);
}
