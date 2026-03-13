import { withRetry } from "../../utils/retry.js";
/**
 * Agent 1: Project Analyzer
 *
 * Analyzes the overall project structure and conventions.
 * Runs ONCE per execution, result is shared across all controllers.
 * Uses a lightweight model since the task is simple analysis.
 */
export async function analyzeProject(projectSummary, model) {
    const prompt = `You are a NestJS project analyzer. Analyze the following project summary and extract conventions.

## Project Summary
${projectSummary}

Respond in this exact JSON format (no markdown, no extra text):
{
  "framework": "NestJS",
  "hasSharedDtos": true/false,
  "sharedDtoPath": "path if exists or null",
  "existingPatterns": ["pattern1", "pattern2"],
  "conventionNotes": ["note1", "note2"]
}`;
    return withRetry("Project Analysis", async () => {
        const response = await model.invoke(prompt);
        const raw = String(response.content).trim();
        // Extract JSON from response
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error("Could not extract JSON from project analysis response");
        }
        return JSON.parse(jsonMatch[0]);
    });
}
/**
 * Build a lightweight project summary from parsed endpoints.
 * This avoids sending the full codebase to the analyzer.
 */
export function buildProjectSummary(controllerClasses, sampleEndpointCount, hasPrisma, modulePaths) {
    return `- Framework: NestJS
- Controllers: ${controllerClasses.length} (${controllerClasses.slice(0, 10).join(", ")}${controllerClasses.length > 10 ? "..." : ""})
- Total endpoints: ${sampleEndpointCount}
- Prisma ORM: ${hasPrisma ? "yes" : "no"}
- Module paths: ${modulePaths.slice(0, 10).join(", ")}${modulePaths.length > 10 ? "..." : ""}`;
}
