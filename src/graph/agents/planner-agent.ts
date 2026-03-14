import type { ChatGoogle } from "@langchain/google";
import type { ControllerGroup, DocumentationPlan, ProjectAnalysis } from "../../types/controller-group.js";
import { buildPlannerPrompt } from "../../prompts/planner-prompt.js";
import { withRetry } from "../../utils/retry.js";

/**
 * Agent 2: Planner
 *
 * Takes a controller's endpoints and produces a structured JSON plan
 * describing all DTOs, enums, and decorator metadata.
 * Uses the strongest model (Pro) for best reasoning about schemas.
 */
export async function planController(
  group: ControllerGroup,
  prismaSchema: string,
  projectAnalysis: ProjectAnalysis | null,
  model: ChatGoogle
): Promise<DocumentationPlan> {
  const analysisStr = projectAnalysis
    ? JSON.stringify(projectAnalysis, null, 2)
    : null;

  const prompt = buildPlannerPrompt(group, prismaSchema || null, analysisStr);

  return withRetry(
    `Plan ${group.controllerClass} (${group.endpoints.length} endpoints)`,
    async () => {
      const response = await model.invoke(prompt);
      const raw = String(response.content);

      return parsePlanResponse(raw, group.controllerClass);
    }
  );
}

function parsePlanResponse(raw: string, controllerClass: string): DocumentationPlan {
  // Strategy 1: Delimiter-based extraction
  const startMarker = "===DOCUMENTATION_PLAN===";
  const endMarker = "===END_DOCUMENTATION_PLAN===";

  const startIdx = raw.indexOf(startMarker);
  const endIdx = raw.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    const jsonStr = raw.slice(startIdx + startMarker.length, endIdx).trim();
    const cleaned = stripCodeFence(jsonStr);
    return validatePlan(JSON.parse(cleaned), controllerClass);
  }

  // Strategy 2: Direct JSON extraction
  const jsonMatch = raw.match(/\{[\s\S]*"controllerClass"[\s\S]*"endpoints"[\s\S]*\}/);
  if (jsonMatch) {
    return validatePlan(JSON.parse(jsonMatch[0]), controllerClass);
  }

  // Strategy 3: Code fence extraction
  const codeFenceMatch = raw.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  if (codeFenceMatch) {
    return validatePlan(JSON.parse(codeFenceMatch[1].trim()), controllerClass);
  }

  throw new Error(
    `Could not extract documentation plan for ${controllerClass}. First 200 chars: ${raw.slice(0, 200)}`
  );
}

function validatePlan(parsed: unknown, controllerClass: string): DocumentationPlan {
  const plan = parsed as DocumentationPlan;

  if (!plan.endpoints || !Array.isArray(plan.endpoints)) {
    throw new Error(`Invalid plan for ${controllerClass}: missing endpoints array`);
  }

  for (const ep of plan.endpoints) {
    if (!ep.methodName || !ep.responseDto) {
      throw new Error(
        `Invalid plan for ${controllerClass}: endpoint missing methodName or responseDto`
      );
    }
  }

  return {
    ...plan,
    controllerClass,
    sharedEnums: plan.sharedEnums ?? [],
  };
}

function stripCodeFence(text: string): string {
  return text
    .replace(/^```(?:json)?\s*\n?/i, "")
    .replace(/\n?\s*```\s*$/i, "")
    .trim();
}
