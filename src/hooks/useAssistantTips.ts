import { useEffect, useRef, useState } from "react";
import type { VisionMode } from "../types/vision";

const passiveTips = [
  "Seret pegangan di atas untuk memindahkan saya.",
  "Klik saya kapan saja untuk membuka chat.",
  "Saya dapat mengambil snapshot layar hanya saat kamu memintanya.",
];

export function useAssistantTips() {
  const [tipIndex, setTipIndex] = useState(0);
  const [message, setMessage] = useState(passiveTips[0]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const notificationUntilRef = useRef(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (Date.now() < notificationUntilRef.current) return;

      setTipIndex((current) => {
        const next = (current + 1) % passiveTips.length;
        setMessage(passiveTips[next]);
        return next;
      });
    }, 9000);

    return () => window.clearInterval(interval);
  }, []);

  const showNotification = (
    content: string,
    durationMilliseconds = 45_000,
  ) => {
    notificationUntilRef.current =
      Date.now() + durationMilliseconds;
    setMessage(
      content.length > 190
        ? `${content.slice(0, 187)}...`
        : content,
    );
  };

  const analyzeScreen = async (
    mode: VisionMode = "general",
    userPrompt?: string,
  ) => {
    if (!window.assistant?.analyzeScreen || isAnalyzing) return;

    setIsAnalyzing(true);
    setMessage("Sedang mengambil snapshot layar...");

    try {
      const result = await window.assistant.analyzeScreen({
        mode,
        userPrompt,
      });
      const compactMessage =
        result.analysis.length > 180
          ? `${result.analysis.slice(0, 177)}...`
          : result.analysis;

      setMessage(compactMessage);
      return result;
    } catch {
      const errorMessage =
        "Analisis gagal. Buka chat dan periksa provider serta API key.";
      setMessage(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    message,
    isAnalyzing,
    analyzeScreen,
    showNotification,
  };
}
