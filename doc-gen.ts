import "dotenv/config";
import * as path from "path";
import * as fs from "fs";
import { execSync } from "child_process";
import { loadTasks } from "./src/nodes/task-loader.js";
import { buildDocGenGraph } from "./src/graph/doc-gen-graph.js";

const args = process.argv.slice(2);
const projectFlag = args.indexOf("--project");

if (projectFlag === -1 || !args[projectFlag + 1]) {
  console.error("Usage: tsx doc-gen.ts --project /path/to/nestjs-project");
  console.error("Options:");
  console.error("  --project <path>   Path to NestJS project root (required)");
  console.error("  --output <path>    Path to save parsed_endpoints.json (default: ./parsed_endpoints.json)");
  process.exit(1);
}

const projectRoot = path.resolve(args[projectFlag + 1]);
const outputFlag = args.indexOf("--output");
const parsedOutputPath = outputFlag !== -1 && args[outputFlag + 1]
  ? path.resolve(args[outputFlag + 1])
  : path.join(process.cwd(), "parsed_endpoints.json");

if (!fs.existsSync(projectRoot)) {
  console.error(`Project not found: ${projectRoot}`);
  process.exit(1);
}

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.error("GOOGLE_API_KEY not set in .env");
  process.exit(1);
}

async function main() {
  console.log("NestJS AI Documentation Generator");
  console.log("==================================");
  console.log(`Target project: ${projectRoot}`);
  console.log("");

  // Step 1: Run the parser
  console.log("Step 1: Parsing NestJS project with ts-morph...");
  try {
    const parserScript = path.join(process.cwd(), "src/parser/nestjs-parser.ts");
    execSync(
      `tsx "${parserScript}" --project "${projectRoot}" > "${parsedOutputPath}"`,
      { stdio: ["inherit", "pipe", "inherit"] }
    );
    console.log(`Parser output saved to: ${parsedOutputPath}`);
  } catch (err) {
    console.error("Parser failed:", err);
    process.exit(1);
  }

  // Step 2: Load tasks
  console.log("\nStep 2: Building task queue...");
  const { taskQueue, prismaSchema } = loadTasks(parsedOutputPath);
  const parsedEndpoints = taskQueue.map((t) => t.endpoint);

  console.log(`Endpoints found: ${parsedEndpoints.length}`);
  console.log(`Prisma schema: ${prismaSchema ? "loaded" : "not found"}`);
  console.log("");

  if (parsedEndpoints.length === 0) {
    console.log("No endpoints found. Exiting.");
    return;
  }

  // Preview task list
  console.log("Endpoints to document:");
  for (const task of taskQueue) {
    const e = task.endpoint;
    const traced = e.tracedService ? `-> ${e.tracedService.serviceClassName}.${e.tracedService.methodName}` : "(service not traced)";
    console.log(`  [${e.httpMethod.padEnd(6)}] ${e.routePath.padEnd(40)} ${traced}`);
  }
  console.log("");

  // Step 3: Run LangGraph documentation generation
  console.log("Step 3: Generating documentation with LLM (one endpoint at a time)...");
  const graph = buildDocGenGraph(apiKey!);

  const result = await graph.invoke(
    {
      projectRoot,
      parsedEndpoints,
      prismaSchema,
      taskQueue,
      currentTaskIndex: 0,
      completedTasks: [],
      failedTasks: [],
      writeLog: [],
    },
    { recursionLimit: parsedEndpoints.length * 3 + 10 }
  );

  // Summary
  console.log("\n==================================");
  console.log("DONE");
  console.log(`  Completed: ${result.completedTasks.length}`);
  console.log(`  Failed:    ${result.failedTasks.length}`);
  console.log(`  Files written: ${result.writeLog.length}`);

  if (result.failedTasks.length > 0) {
    console.log("\nFailed endpoints:");
    for (const t of result.failedTasks) {
      console.log(`  - ${t.endpoint.httpMethod} ${t.endpoint.routePath}: ${t.error}`);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
