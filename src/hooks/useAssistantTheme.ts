import { useState } from "react";
import {
  assistantThemes,
  defaultAssistantTheme,
} from "../config/assistantThemes";

const STORAGE_KEY = "omni-assistant-theme";

function getInitialThemeId() {
  const storedThemeId = localStorage.getItem(STORAGE_KEY);
  return assistantThemes.some((theme) => theme.id === storedThemeId)
    ? storedThemeId!
    : defaultAssistantTheme.id;
}

export function useAssistantTheme() {
  const [themeId, setThemeId] = useState(getInitialThemeId);
  const theme =
    assistantThemes.find((item) => item.id === themeId) ??
    defaultAssistantTheme;

  const selectTheme = (nextThemeId: string) => {
    setThemeId(nextThemeId);
    localStorage.setItem(STORAGE_KEY, nextThemeId);
  };

  return { theme, themeId, selectTheme };
}
