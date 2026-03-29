import { describe, expect, it } from "vitest";
import { buildMessageTimeline } from "@/components/messages/threadTimeline";
import type { ThreadMessage, ThreadSystemEvent } from "@/hooks/useMessagingHub";

describe("buildMessageTimeline", () => {
  it("sorts system events and messages into a single ascending timeline", () => {
    const messages: ThreadMessage[] = [
      {
        content: "Second message",
        created_at: "2026-03-29T11:05:00.000Z",
        id: "message-2",
        is_from_me: false,
        sender_id: "sender-2",
        sender_role: "parent",
        thread_id: "thread-1",
      },
      {
        content: "First message",
        created_at: "2026-03-29T11:00:00.000Z",
        id: "message-1",
        is_from_me: true,
        sender_id: "sender-1",
        sender_role: "parent",
        thread_id: "thread-1",
      },
    ];

    const systemEvents: ThreadSystemEvent[] = [
      {
        actorId: null,
        actorName: null,
        eventType: "conversation_started",
        id: "system-1",
        note: "Conversation started",
        timestamp: "2026-03-29T10:55:00.000Z",
        type: "system",
      },
      {
        actorId: "sender-2",
        actorName: "Jessica",
        callType: "audio",
        eventType: "call_missed",
        id: "system-2",
        note: "No answer.",
        timestamp: "2026-03-29T11:03:00.000Z",
        type: "system",
      },
    ];

    expect(buildMessageTimeline(messages, systemEvents)).toEqual([
      {
        event: systemEvents[0],
        id: "system-1",
        kind: "system",
        timestamp: "2026-03-29T10:55:00.000Z",
      },
      {
        id: "message-1",
        kind: "message",
        message: messages[1],
        timestamp: "2026-03-29T11:00:00.000Z",
      },
      {
        event: systemEvents[1],
        id: "system-2",
        kind: "system",
        timestamp: "2026-03-29T11:03:00.000Z",
      },
      {
        id: "message-2",
        kind: "message",
        message: messages[0],
        timestamp: "2026-03-29T11:05:00.000Z",
      },
    ]);
  });
});
