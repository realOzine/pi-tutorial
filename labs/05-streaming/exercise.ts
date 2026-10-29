// Consume provider-independent increments without committing unfinished tool arguments.
import type { ModelResponse } from "../shared/contracts.ts";

export type StreamPart =
  | { type: "text"; delta: string }
  | { type: "tool-start"; id: string; name: string }
  | { type: "tool-delta"; id: string; delta: string }
  | { type: "finish"; stopReason: ModelResponse["stopReason"]; usage: ModelResponse["usage"] };

export type StreamEvent =
  | { type: "preview"; text: string; pending: { id: string; name: string; argumentsText: string }[] }
  | { type: "commit"; response: ModelResponse };

export type StreamListener = (event: StreamEvent) => void | Promise<void>;

/** Accumulate increments, commit exactly once at finish, and await each listener. */
export async function consumeStream(
  _parts: AsyncIterable<StreamPart>,
  _signal: AbortSignal,
  _onEvent: StreamListener = () => {},
): Promise<ModelResponse> {
  throw new Error("TODO: 区分 preview 与 commit，并拒绝未完成或截断的工具参数");
}
