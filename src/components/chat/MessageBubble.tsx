import type { ChatMessage } from "../../types/chat";

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "rounded-br-md bg-indigo-600 text-white"
            : "rounded-bl-md bg-slate-100 text-slate-700"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
