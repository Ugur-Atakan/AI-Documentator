export interface ParsedParam {
  decorator: "@Body" | "@Param" | "@Query" | "@Headers";
  name?: string;
  typeName: string;
  isOptional: boolean;
}

export interface TracedServiceMethod {
  serviceClassName: string;
  methodName: string;
  sourceCode: string;
  returnTypeName: string;
  prismaModelsReferenced: string[];
}

export interface ParsedEndpoint {
  id: string;
  controllerClass: string;
  controllerFilePath: string;
  httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  routePath: string;
  methodName: string;
  methodSignature: string;
  params: ParsedParam[];
  controllerMethodCode: string;
  tracedService: TracedServiceMethod | null;
  traceFailureReason?: string;
}

export interface ParserOutput {
  projectRoot: string;
  parsedAt: string;
  prismaSchemaPath: string | null;
  prismaSchemaContent: string | null;
  endpoints: ParsedEndpoint[];
}

export interface GeneratedDocs {
  requestDtoCode: string | null;
  responseDtoCode: string;
  controllerDecorators: string;
  outputPaths: {
    requestDto: string | null;
    responseDto: string;
    decorators: string;
  };
}

export interface EndpointTask {
  endpoint: ParsedEndpoint;
  status: "pending" | "in_progress" | "completed" | "failed";
  result?: GeneratedDocs;
  error?: string;
}
