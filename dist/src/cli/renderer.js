import logUpdate from "log-update";
import chalk from "chalk";
const SPINNER = [".", "..", "..."];
let frame = 0;
const DIM = chalk.dim;
const ACCENT = chalk.cyan;
function methodStr(method) {
    return DIM(method.padEnd(7));
}
function statusTag(status) {
    switch (status) {
        case "pending": return DIM("       ");
        case "dto": return ACCENT("dto    ");
        case "swagger": return ACCENT("swagger");
        case "writing": return ACCENT("write  ");
        case "done": return DIM("done   ");
        case "failed": return chalk.red("failed ");
        case "skipped": return DIM("skip   ");
    }
}
function controllerStatusTag(status) {
    switch (status) {
        case "pending": return DIM("pending    ");
        case "analyzing": return ACCENT("analyzing  ");
        case "planning": return ACCENT("planning   ");
        case "generating": return ACCENT("generating ");
        case "reviewing": return ACCENT("reviewing  ");
        case "writing": return ACCENT("writing    ");
        case "done": return DIM("done       ");
        case "failed": return chalk.red("failed     ");
        case "skipped": return DIM("skipped    ");
    }
}
function statusIcon(status) {
    switch (status) {
        case "pending": return DIM("  ");
        case "dto":
        case "swagger":
        case "writing":
        case "analyzing":
        case "planning":
        case "generating":
        case "reviewing": return ACCENT(SPINNER[frame % SPINNER.length].padEnd(3));
        case "done": return DIM("ok ");
        case "failed": return chalk.red("x  ");
        case "skipped": return DIM("-  ");
    }
}
/**
 * Fixed-height terminal renderer using log-update.
 * Supports both legacy endpoint-based and new controller-based modes.
 */
export class Renderer {
    endpoints = [];
    controllers = [];
    mode = "endpoint";
    interval = null;
    startTime = Date.now();
    /** Total lines the render block occupies — never changes mid-run */
    VISIBLE_LINES = 15;
    // ── Endpoint mode (legacy) ──────────────────────────────────────────────
    start(endpoints) {
        this.endpoints = endpoints;
        this.mode = "endpoint";
        this.startTime = Date.now();
        this.render();
        this.interval = setInterval(() => {
            frame++;
            this.render();
        }, 200);
    }
    update(index, status, error) {
        if (this.endpoints[index]) {
            this.endpoints[index].status = status;
            if (error)
                this.endpoints[index].error = error;
        }
    }
    // ── Controller mode (new) ───────────────────────────────────────────────
    startControllers(controllers) {
        this.controllers = controllers;
        this.mode = "controller";
        this.startTime = Date.now();
        this.render();
        this.interval = setInterval(() => {
            frame++;
            this.render();
        }, 200);
    }
    updateController(index, status, error) {
        if (this.controllers[index]) {
            this.controllers[index].status = status;
            if (error)
                this.controllers[index].error = error;
        }
    }
    // ── Shared ──────────────────────────────────────────────────────────────
    render() {
        if (this.mode === "controller") {
            this.renderControllers();
        }
        else {
            this.renderEndpoints();
        }
    }
    renderEndpoints() {
        const done = this.endpoints.filter((e) => e.status === "done").length;
        const failed = this.endpoints.filter((e) => e.status === "failed").length;
        const skipped = this.endpoints.filter((e) => e.status === "skipped").length;
        const active = this.endpoints.filter((e) => ["dto", "swagger", "writing"].includes(e.status)).length;
        const total = this.endpoints.length;
        const remaining = total - done - failed - skipped - active;
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);
        // Progress bar
        const pct = total > 0 ? (done + failed + skipped) / total : 0;
        const barWidth = 30;
        const filled = Math.round(pct * barWidth);
        const bar = ACCENT("=".repeat(filled)) + DIM("-".repeat(barWidth - filled));
        // Collect visible lines
        const activeEps = this.endpoints.filter((e) => ["dto", "swagger", "writing"].includes(e.status));
        const recentDone = this.endpoints
            .filter((e) => e.status === "done" || e.status === "failed")
            .slice(-3);
        const pendingPeek = this.endpoints
            .filter((e) => e.status === "pending")
            .slice(0, 1);
        const epLines = [];
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
        const lines = [
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
    renderControllers() {
        const done = this.controllers.filter((c) => c.status === "done").length;
        const failed = this.controllers.filter((c) => c.status === "failed").length;
        const skipped = this.controllers.filter((c) => c.status === "skipped").length;
        const activeStatuses = ["analyzing", "planning", "generating", "reviewing", "writing"];
        const active = this.controllers.filter((c) => activeStatuses.includes(c.status)).length;
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
        const activeControllers = this.controllers.filter((c) => activeStatuses.includes(c.status));
        const recentDone = this.controllers
            .filter((c) => c.status === "done" || c.status === "failed")
            .slice(-2);
        const pendingPeek = this.controllers
            .filter((c) => c.status === "pending")
            .slice(0, 1);
        const ctrlLines = [];
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
        const lines = [
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
        if (failed > 0)
            footerParts.push(chalk.red(`${failed} failed`));
        footerParts.push(`${elapsed}s elapsed`);
        lines.push(DIM("  " + footerParts.join("  ·  ")));
        logUpdate(lines.join("\n"));
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        frame++;
        this.render();
        logUpdate.done();
    }
    getStats() {
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
    getFailedEndpoints() {
        return this.endpoints.filter((e) => e.status === "failed");
    }
    getFailedControllers() {
        return this.controllers.filter((c) => c.status === "failed");
    }
}
function truncate(str, max) {
    return str.length > max ? str.slice(0, max - 1) + "…" : str.padEnd(max);
}
