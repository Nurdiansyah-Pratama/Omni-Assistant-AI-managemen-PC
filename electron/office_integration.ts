import { addDecision, updatePreference } from "./memory_manager";
import { requestAiChat } from "./ai/ai_router";

export interface OfficeRequestPayload {
  app?: string;
  action?: string;
  selectedText?: string;
  context?: Record<string, unknown>;
  userInstruction?: string;
  tone?: string;
  language?: string;
}

export interface OfficeResponsePayload {
  success: boolean;
  result: string;
  suggestedAction: "insert" | "replace" | "preview";
  warnings: string[];
}

const actionPrompts: Record<string, string> = {
  chat: "Jawab permintaan user berdasarkan konteks Office yang diberikan.",
  rewrite: "Tulis ulang teks agar lebih jelas, rapi, dan sesuai instruksi.",
  summarize: "Ringkas konten menjadi poin penting yang mudah dipahami.",
  generate: "Buat konten baru sesuai instruksi dan konteks Office.",
  format: "Rapikan format, struktur, dan gaya teks. Beri hasil siap pakai.",
  explain: "Jelaskan isi atau maksud konten dengan bahasa sederhana.",
  grammar: "Perbaiki grammar, ejaan, dan keterbacaan tanpa mengubah makna.",
  translate: "Terjemahkan konten sesuai bahasa target dari instruksi user.",
  professional: "Ubah gaya bahasa menjadi lebih profesional.",
  academic: "Ubah gaya bahasa menjadi akademik, formal, dan terstruktur.",
  continue: "Lanjutkan tulisan dengan gaya yang konsisten.",
  excelFormula: "Buat atau jelaskan formula Excel dari instruksi user.",
  excelAnalyze: "Analisis range atau tabel Excel dan berikan insight praktis.",
  powerpointSlides: "Buat outline slide, bullet point, atau speaker notes.",
  projectPlan: "Buat struktur project, task, timeline, dependency, dan risiko.",
  outlookEmail: "Buat, balas, ringkas, atau rapikan email sesuai tone.",
};

function sanitizeText(value: unknown, maxLength = 12_000) {
  if (typeof value !== "string") return "";
  return value
    .replace(/(password|token|api[_ -]?key|secret)\s*[:=]\s*\S+/gi, "[REDACTED]")
    .slice(0, maxLength);
}

function buildOfficePrompt(input: Required<OfficeRequestPayload>) {
  const context = JSON.stringify(input.context, null, 2).slice(0, 8_000);
  const instruction = actionPrompts[input.action] ?? actionPrompts.chat;

  return [
    "Kamu adalah Omni Office Assistant yang berjalan lokal untuk membantu aplikasi Microsoft Office.",
    "Default bahasa jawaban adalah Bahasa Indonesia kecuali user meminta English.",
    "Jangan mengklaim sudah menyimpan, mengirim email, atau mengubah dokumen. Add-in hanya akan insert/replace setelah user klik tombol.",
    "Jangan menampilkan password, token, API key, atau data sensitif. Jika terlihat data sensitif, beri peringatan singkat.",
    `Aplikasi Office: ${input.app}`,
    `Action: ${input.action}`,
    `Bahasa: ${input.language}`,
    `Tone: ${input.tone || "default"}`,
    `Instruksi tugas: ${instruction}`,
    input.userInstruction ? `Instruksi user: ${input.userInstruction}` : "",
    input.selectedText ? `Teks terpilih:\n${input.selectedText}` : "",
    `Konteks dokumen:\n${context}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normalizeOfficeRequest(payload: OfficeRequestPayload) {
  return {
    app: sanitizeText(payload.app, 80) || "Unknown",
    action: sanitizeText(payload.action, 80) || "chat",
    selectedText: sanitizeText(payload.selectedText),
    context:
      payload.context && typeof payload.context === "object"
        ? payload.context
        : {},
    userInstruction: sanitizeText(payload.userInstruction),
    tone: sanitizeText(payload.tone, 80),
    language: sanitizeText(payload.language, 20) || "id-ID",
  };
}

function suggestedActionFor(action: string): OfficeResponsePayload["suggestedAction"] {
  if (["rewrite", "format", "grammar", "translate", "professional", "academic"].includes(action)) {
    return "replace";
  }
  if (["summarize", "explain", "excelAnalyze"].includes(action)) {
    return "preview";
  }
  return "insert";
}

export async function handleOfficeRequest(
  rawPayload: OfficeRequestPayload,
): Promise<OfficeResponsePayload> {
  const payload = normalizeOfficeRequest(rawPayload);
  const warnings: string[] = [];

  if (!payload.selectedText && !payload.userInstruction) {
    warnings.push("Tidak ada selection atau instruksi user. Hasil mungkin terlalu umum.");
  }

  if (JSON.stringify(payload.context).length > 10_000) {
    warnings.push("Konteks dokumen dipotong agar aman dan cepat diproses.");
  }

  updatePreference("lastOfficeApp", payload.app);
  updatePreference("lastOfficeAction", payload.action);
  addDecision(`Office action: ${payload.app}/${payload.action}`);

  const prompt = buildOfficePrompt(payload);
  const response = await requestAiChat({
    messages: [{ role: "user", content: prompt }],
    mode:
      payload.action.includes("excel") || payload.action.includes("project")
        ? "coding"
        : "general",
    focus: "Office productivity",
  });

  if (!response.ok) {
    return {
      success: false,
      result: response.error.message,
      suggestedAction: "preview",
      warnings,
    };
  }

  return {
    success: true,
    result: response.message,
    suggestedAction: suggestedActionFor(payload.action),
    warnings,
  };
}
