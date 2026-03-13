import * as fs from "fs";
import * as path from "path";
/**
 * Analyzes a NestJS project structure and suggests the best output directories.
 * Returns suggestions ranked by relevance.
 */
export function suggestOutputDirs(projectRoot) {
    const suggestions = [];
    // 1. Central dtos/ directory (vmh-server-v2 pattern)
    const centralDtos = path.join(projectRoot, "src", "dtos");
    if (fs.existsSync(centralDtos)) {
        suggestions.push({
            path: centralDtos,
            label: "src/dtos/ (existing)",
            reason: "Project already has a central DTOs directory",
        });
    }
    // 2. generated/ directory (clean separation)
    const generated = path.join(projectRoot, "src", "generated");
    suggestions.push({
        path: generated,
        label: "src/generated/",
        reason: "Clean separation — all AI-generated code in one place",
    });
    // 3. Standalone output in documentator project
    const standalone = path.join(process.cwd(), "output");
    suggestions.push({
        path: standalone,
        label: "./output/ (standalone)",
        reason: "Outside the target project — safe for review before copying",
    });
    // 4. Next to controllers (default mode, no outputDir)
    suggestions.push({
        path: "",
        label: "Next to controllers (dto/ subdirs)",
        reason: "Each controller gets a dto/ folder beside it",
    });
    return suggestions;
}
