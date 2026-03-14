import { ChatGoogle } from "@langchain/google";
import type { ParsedEndpoint } from "../types/endpoint.js";
export declare function generateDtos(endpoint: ParsedEndpoint, prismaSchema: string, model: ChatGoogle): Promise<{
    requestDtoCode: string | null;
    responseDtoCode: string;
}>;
