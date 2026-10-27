import type { NativeImage } from "electron";
import type { VisionSettings } from "./visionSettings";
import { logAiEvent } from "./ai/ai_logger";

export type VisionMode = "general" | "coding" | "design";
export type VisionCapableProvider = "openai" | "gemini";

const modeInstructions: Record<VisionMode, string> = {
  general:
    "Jelaskan apa yang terlihat, informasi penting, dan maksimal tiga saran praktis.",
  coding:
    "Fokus pada editor, terminal, pesan error, kode, dan langkah debugging. Jangan mengarang teks yang tidak terbaca.",
  design:
    "Fokus pada hierarki visual, alignment, spacing, warna, tipografi, aksesibilitas, dan maksimal tiga perbaikan paling berdampak.",
};

function buildPrompt(mode: VisionMode, userPrompt?: string) {
  return [
    "Kamu adalah Omni, asisten desktop yang menganalisis satu screenshot yang secara eksplisit dibagikan pengguna.",
    "Jawab dalam Bahasa Indonesia, ringkas, konkret, dan ramah.",
    "Jangan mengklaim telah mengklik, mengetik, mengubah file, atau melakukan tindakan pada komputer.",
    "Jangan menebak data sensitif atau teks yang tidak jelas. Sebutkan keterbatasan bila gambar tidak cukup.",
    modeInstructions[mode],
    userPrompt?.trim() ? `Permintaan pengguna: ${userPrompt.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function getDataUrl(image: NativeImage) {
  const size = image.getSize();
  const resized =
    size.width > 1600
      ? image.resize({ width: 1600, quality: "good" })
      : image;

  return `data:image/jpeg;base64,${resized.toJPEG(82).toString("base64")}`;
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    payload.error &&
    typeof payload.error === "object" &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return fallback;
}

async function analyzeWithOpenAI(
  image: NativeImage,
  prompt: string,
  settings: VisionSettings,
) {
  if (!settings.openaiApiKey) {
    throw new Error("API key OpenAI belum dikonfigurasi.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.openaiModel,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_image",
              image_url: getDataUrl(image),
              detail: "high",
            },
          ],
        },
      ],
      text: { verbosity: "low" },
    }),
  });
  const payload = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload, `OpenAI gagal dengan status ${response.status}.`),
    );
  }

  const text =
    payload.output_text ??
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")?.text;

  if (!text) throw new Error("OpenAI tidak mengembalikan hasil analisis.");
  return text;
}

async function analyzeWithGemini(
  image: NativeImage,
  prompt: string,
  settings: VisionSettings,
) {
  if (!settings.geminiApiKey) {
    throw new Error("API key Gemini belum dikonfigurasi.");
  }

  const base64Image = getDataUrl(image).split(",")[1];
  const model = encodeURIComponent(settings.geminiModel);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Image,
                },
              },
              { text: prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 700,
        },
      }),
    },
  );
  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload, `Gemini gagal dengan status ${response.status}.`),
    );
  }

  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? "")
    .join("")
    .trim();

  if (!text) throw new Error("Gemini tidak mengembalikan hasil analisis.");
  return text;
}

export async function analyzeScreenshot(input: {
  image: NativeImage;
  mode: VisionMode;
  userPrompt?: string;
  settings: VisionSettings;
}): Promise<{ analysis: string; provider: VisionCapableProvider }> {
  const prompt = buildPrompt(input.mode, input.userPrompt);
  const candidates = getVisionCandidates(input.settings);

  logAiEvent("vision_request", {
    provider: input.settings.provider,
    mode: input.mode,
    candidates,
  });

  if (!candidates.length) {
    throw new Error("Provider ini tidak mendukung vision. Gunakan OpenAI atau Gemini.");
  }

  let lastError: Error | null = null;

  for (const provider of candidates) {
    try {
      const analysis =
        provider === "gemini"
          ? await analyzeWithGemini(input.image, prompt, input.settings)
          : await analyzeWithOpenAI(input.image, prompt, input.settings);
      return { analysis, provider };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Analisis vision gagal.");
      logAiEvent("api_error", {
        provider,
        message: lastError.message,
      });
    }
  }

  throw lastError ?? new Error("Analisis vision gagal.");
}

function getVisionCandidates(settings: VisionSettings): VisionCapableProvider[] {
  if (settings.provider === "huggingface") return [];
  if (settings.provider === "openai") {
    return settings.openaiApiKey
      ? ["openai", ...(settings.geminiApiKey ? ["gemini" as const] : [])]
      : settings.geminiApiKey
        ? ["gemini"]
        : [];
  }
  if (settings.provider === "gemini") {
    return settings.geminiApiKey
      ? ["gemini", ...(settings.openaiApiKey ? ["openai" as const] : [])]
      : settings.openaiApiKey
        ? ["openai"]
        : [];
  }
  return [
    ...(settings.openaiApiKey ? ["openai" as const] : []),
    ...(settings.geminiApiKey ? ["gemini" as const] : []),
  ];
}
