import type { AssistantTheme } from "../types/assistantTheme";

export const assistantThemes: AssistantTheme[] = [
  { id: "blue", label: "Biru", accent: "#2563eb", glow: "#22d3ee" },
  { id: "yellow", label: "Kuning", accent: "#eab308", glow: "#fde047" },
  { id: "violet", label: "Ungu", accent: "#7c3aed", glow: "#c084fc" },
  { id: "red", label: "Merah", accent: "#dc2626", glow: "#fb7185" },
  { id: "green", label: "Hijau", accent: "#16a34a", glow: "#4ade80" },
];

export const defaultAssistantTheme = assistantThemes[0];
