import { useState } from "react";
import type { ChatMessage } from "../types/chat";
import type { VisionMode } from "../types/vision";

const initialMessages: ChatMessage[] = [
  {
    id: crypto.randomUUID(),
    role: "assistant",
    content: "Halo! Saya Omni. Ada yang bisa saya bantu?",
  },
];

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isReplying, setIsReplying] = useState(false);

  const sendMessage = async (
    content: string,
    mode: VisionMode = "general",
    focus?: string,
  ) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };

    setMessages((current) => [...current, userMessage]);
    setIsReplying(true);

    try {
      const response = window.assistant?.chat
        ? await window.assistant.chat({
            messages: [...messages, userMessage],
            mode,
            focus,
          })
        : {
            ok: false as const,
            error: {
              code: "request_failed" as const,
              message: "AI belum tersedia pada mode browser.",
            },
          };

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.ok ? response.message : response.error.message,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Terjadi error internal saat memproses chat. Coba lagi.",
        },
      ]);
    } finally {
      setIsReplying(false);
    }
  };

  const addAssistantMessage = (content: string) => {
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
      },
    ]);
  };

  return { messages, isReplying, sendMessage, addAssistantMessage };
}
