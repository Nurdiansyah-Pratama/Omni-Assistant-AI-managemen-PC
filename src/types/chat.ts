export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  mode?: "general" | "coding" | "design";
  focus?: string;
}

export type ChatResponse =
  | {
      ok: true;
      message: string;
      provider?: "openai" | "gemini" | "huggingface";
      model?: string;
      latencyMs?: number;
      fallbackUsed?: boolean;
    }
  | {
      ok: false;
      error: {
        code:
          | "missing_api_key"
          | "invalid_messages"
          | "request_failed";
        message: string;
      };
    };
