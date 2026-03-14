import * as fs from "fs";
import * as path from "path";
import type { ModelConfig } from "../graph/model-factory.js";

const CONFIG_FILE = ".documentator.json";

export interface ResolvedConfig {
  project: string;
  outputDir?: string;
  dryRun: boolean;
  skipExisting: boolean;
  modules?: string[];
  model: string;
  concurrency: number;
  /** Multi-model config for new pipeline */
  models?: Partial<ModelConfig>;
  /** Use legacy per-endpoint pipeline */
  legacy: boolean;
}

interface FileConfig {
  project?: string;
  outputDir?: string;
  model?: string;
  concurrency?: number;
  skipExisting?: boolean;
  modules?: string[];
  models?: Partial<ModelConfig>;
  legacy?: boolean;
}

function loadFileConfig(): FileConfig {
  const configPath = path.join(process.cwd(), CONFIG_FILE);
  if (!fs.existsSync(configPath)) return {};

  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as FileConfig;
  } catch {
    return {};
  }
}

/**
 * Merges file config (.documentator.json) with CLI flags.
 * CLI flags always take precedence over file config.
 */
export function resolveConfig(cliOpts: {
  project?: string;
  outputDir?: string;
  module?: string[];
  concurrency?: string;
  model?: string;
  dryRun?: boolean;
  noSkip?: boolean;
  legacy?: boolean;
  plannerModel?: string;
  writerModel?: string;
}): ResolvedConfig {
  const file = loadFileConfig();

  const project = cliOpts.project ?? file.project;
  if (!project) {
    console.error("No project specified. Use --project or create .documentator.json with `documentator init`.");
    process.exit(1);
  }

  // Build multi-model config from CLI flags or file config
  let models: Partial<ModelConfig> | undefined = file.models;
  if (cliOpts.plannerModel || cliOpts.writerModel) {
    models = {
      ...models,
      ...(cliOpts.plannerModel ? { planner: cliOpts.plannerModel } : {}),
      ...(cliOpts.writerModel ? { writer: cliOpts.writerModel } : {}),
    };
  }

  return {
    project: path.resolve(project),
    outputDir: cliOpts.outputDir
      ? path.resolve(cliOpts.outputDir)
      : file.outputDir
        ? path.resolve(file.outputDir)
        : undefined,
    dryRun: cliOpts.dryRun ?? false,
    skipExisting: cliOpts.noSkip ? false : (file.skipExisting ?? true),
    modules: cliOpts.module?.length ? cliOpts.module : file.modules,
    model: cliOpts.model ?? file.model ?? "gemini-2.5-flash",
    concurrency: cliOpts.concurrency
      ? parseInt(cliOpts.concurrency, 10)
      : file.concurrency ?? 5,
    models,
    legacy: cliOpts.legacy ?? file.legacy ?? false,
  };
}
