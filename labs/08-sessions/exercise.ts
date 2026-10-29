// Lesson 08: reconstruct one branch without replaying uncertain side effects.
import type { Message, ToolCall } from "../shared/contracts.ts";

export type SessionEntry = { version: 1; id: string; parentId: string | null; message: Message };
export type SessionProjection = {
  status: "ready" | "needs_review";
  messages: Message[];
  pending: ToolCall[];
  leafId: string | null;
};

/** Project the selected branch and hold back an incomplete tool exchange. */
export function projectSession(entries: readonly SessionEntry[], leafId: string | null): SessionProjection {
  void entries; void leafId;
  throw new Error("TODO: follow parentId, validate tool pairs, report uncertain calls without executing them");
}
