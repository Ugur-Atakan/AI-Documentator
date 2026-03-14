import * as fs from "fs";
import { ParserOutputSchema } from "../schemas/endpoint-schema.js";
export function loadTasks(parsedOutputPath) {
    if (!fs.existsSync(parsedOutputPath)) {
        throw new Error(`Parsed output not found: ${parsedOutputPath}`);
    }
    const raw = fs.readFileSync(parsedOutputPath, "utf-8");
    const json = JSON.parse(raw);
    const validated = ParserOutputSchema.parse(json);
    const taskQueue = validated.endpoints.map((endpoint) => ({
        endpoint,
        status: "pending",
    }));
    return {
        parsedEndpoints: validated.endpoints,
        prismaSchema: validated.prismaSchemaContent ?? "",
        taskQueue,
    };
}
