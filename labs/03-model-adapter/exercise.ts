// Translate course messages into Responses input items and validate the returned response.
import type { Model, ModelRequest, ModelResponse } from "../shared/contracts.ts";
import { createResponsesTransport, type OpenAIModelConfig } from "./transport.ts";

export function encodeRequest(_request: ModelRequest, _model: string, _maxOutputTokens: number): Record<string, unknown> {
  throw new Error("TODO 03: map user/assistant/tool messages to Responses input items");
}

export function decodeResponse(_body: unknown): ModelResponse {
  throw new Error("TODO 03: validate Responses output, call IDs, stop status and usage");
}

export function createOpenAIModel(config: OpenAIModelConfig): Model {
  return createResponsesTransport(config, encodeRequest, decodeResponse);
}
