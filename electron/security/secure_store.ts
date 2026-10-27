import { safeStorage } from "electron";

export function encryptSecret(value: string) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Enkripsi credential tidak tersedia pada sistem ini.");
  }

  return safeStorage.encryptString(value).toString("base64");
}

export function decryptSecret(value?: string) {
  if (!value || !safeStorage.isEncryptionAvailable()) return undefined;

  try {
    return safeStorage.decryptString(Buffer.from(value, "base64"));
  } catch {
    return undefined;
  }
}

export function maskSecret(provider: string, value?: string) {
  if (!value) return "";

  if (provider === "openai") return "sk-....";
  if (provider === "gemini") return "AIza....";
  if (provider === "huggingface") return "hf_....";

  return "****";
}
