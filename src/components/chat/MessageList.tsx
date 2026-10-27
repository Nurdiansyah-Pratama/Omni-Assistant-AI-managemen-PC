import { useEffect, useRef } from "react";
import type { ChatMessage } from "../../types/chat";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: ChatMessage[];
  isReplying: boolean;
}

export function MessageList({ messages, isReplying }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isReplying]);

  return (
    <section
      className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      aria-live="polite"
    >
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}

      {isReplying && (
        <div className="flex justify-start">
          <div className="flex gap-1 rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-2 w-2 animate-bounce rounded-full bg-slate-400"
                style={{ animationDelay: `${dot * 120}ms` }}
              />
            ))}
          </div>
        </div>
      )}
      <div ref={endRef} />
    </section>
  );
}
