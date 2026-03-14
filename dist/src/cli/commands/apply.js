import * as fs from "fs";
import * as path from "path";
import chalk from "chalk";
import { scanMatches, applyToControllers } from "../../applier/controller-applier.js";
const DIM = chalk.dim;
const ACCENT = chalk.cyan;
export async function applyCommand(opts) {
    const projectPath = opts.project ? path.resolve(opts.project) : process.cwd();
    const dryRun = !opts.write;
    if (!fs.existsSync(projectPath)) {
        console.error(`  Project not found: ${projectPath}`);
        process.exit(1);
    }
    console.log(DIM("  Scanning controllers...\n"));
    const matches = scanMatches(projectPath, opts.module);
    if (matches.length === 0) {
        console.log(DIM("  No matching endpoints found. Generate documentation first.\n"));
        return;
    }
    // Group by controller
    const byController = new Map();
    for (const m of matches) {
        const existing = byController.get(m.controllerFile) ?? [];
        existing.push(m);
        byController.set(m.controllerFile, existing);
    }
    // Print preview
    const relPath = (p) => path.relative(projectPath, p);
    for (const [controllerFile, methods] of byController) {
        const hasAny = methods.some((m) => !m.skipped);
        if (!hasAny)
            continue;
        console.log(`  ${relPath(controllerFile)}`);
        for (const m of methods) {
            if (m.skipped) {
                console.log(`    ${DIM(m.methodName.padEnd(28))} ${DIM(m.skipReason ?? "skipped")}`);
                continue;
            }
            const actions = m.actions.join("  ");
            const method = DIM(m.httpMethod.padEnd(7));
            console.log(`    ${m.methodName.padEnd(28)} ${method} ${ACCENT(actions)}`);
        }
        console.log();
    }
    // Summary
    const actionable = matches.filter((m) => !m.skipped);
    const skippedCount = matches.filter((m) => m.skipped).length;
    console.log(DIM("  " + "-".repeat(50)));
    console.log(`  ${actionable.length} methods to update, ${skippedCount} skipped`);
    if (dryRun) {
        console.log(DIM(`  Dry-run mode. Run with --write to apply changes.\n`));
        return;
    }
    // Apply
    console.log(DIM("\n  Applying changes...\n"));
    const result = applyToControllers(matches, false);
    console.log(DIM("  " + "-".repeat(50)));
    console.log(`  ${ACCENT(String(result.applied))} methods updated across ${result.controllers} controllers`);
    console.log(`  ${DIM(String(result.skipped))} skipped`);
    console.log(DIM("\n  Review changes with: git diff\n"));
}
