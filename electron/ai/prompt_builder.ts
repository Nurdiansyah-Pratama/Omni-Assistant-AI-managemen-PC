import type { VisionMode } from "../vision";
import type { VisionProvider } from "../visionSettings";

const modeInstructions: Record<VisionMode, string> = {
  general: "Jawab ringkas, praktis, dan langsung ke langkah yang bisa dilakukan.",
  coding:
    "Fokus pada debugging, struktur kode, error handling, risiko regresi, dan langkah verifikasi.",
  design:
    "Fokus pada UI/UX, warna, layout, visual hierarchy, keterbacaan, dan aksesibilitas.",
};

export function buildSystemPrompt(input: {
  mode: VisionMode;
  focus?: string;
  provider: VisionProvider;
  model: string;
}) {
  return [
    "Kamu adalah Omni Assistant, AI system manager desktop yang membantu user bekerja lebih cepat.",
    "Jawab dalam Bahasa Indonesia yang natural, singkat, konkret, dan aman.",
    "Jangan mengklaim sudah mengklik, mengetik, menjalankan command, membaca dashboard PC, atau melihat layar kecuali user memang meminta analisis layar.",
    modeInstructions[input.mode],
    input.focus?.trim() ? `Fokus analisis user: ${input.focus.trim()}` : "",
    `Provider aktif: ${input.provider}. Model aktif: ${input.model}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function normalizeChatMessages(messages: unknown) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (
        message,
      ): message is { role: "user" | "assistant"; content: string } =>
        Boolean(message) &&
        typeof message === "object" &&
        "role" in message &&
        (message.role === "user" || message.role === "assistant") &&
        "content" in message &&
        typeof message.content === "string" &&
        Boolean(message.content.trim()),
    )
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }));
}
