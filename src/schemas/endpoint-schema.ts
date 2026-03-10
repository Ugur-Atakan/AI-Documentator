import { z } from "zod";

export const ParsedParamSchema = z.object({
  decorator: z.enum(["@Body", "@Param", "@Query", "@Headers"]),
  name: z.string().optional(),
  typeName: z.string(),
  isOptional: z.boolean(),
});

export const TracedServiceMethodSchema = z.object({
  serviceClassName: z.string(),
  methodName: z.string(),
  sourceCode: z.string(),
  returnTypeName: z.string(),
  prismaModelsReferenced: z.array(z.string()),
});

export const ParsedEndpointSchema = z.object({
  id: z.string(),
  controllerClass: z.string(),
  controllerFilePath: z.string(),
  httpMethod: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  routePath: z.string(),
  methodName: z.string(),
  methodSignature: z.string(),
  params: z.array(ParsedParamSchema),
  controllerMethodCode: z.string(),
  tracedService: TracedServiceMethodSchema.nullable(),
  traceFailureReason: z.string().optional(),
});

export const ParserOutputSchema = z.object({
  projectRoot: z.string(),
  parsedAt: z.string(),
  prismaSchemaPath: z.string().nullable(),
  prismaSchemaContent: z.string().nullable(),
  endpoints: z.array(ParsedEndpointSchema),
});

export const GeneratedDtosSchema = z.object({
  requestDtoCode: z.string().nullable(),
  responseDtoCode: z.string().min(1),
});

export const GeneratedSwaggerSchema = z.object({
  controllerDecorators: z.string().min(1),
});
