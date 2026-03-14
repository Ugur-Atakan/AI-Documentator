import { ChatGoogle } from "@langchain/google";
import type { ParsedEndpoint } from "../types/endpoint.js";
export declare function generateSwagger(endpoint: ParsedEndpoint, requestDtoCode: string | null, responseDtoCode: string, model: ChatGoogle): Promise<{
    controllerDecorators: string;
}>;
