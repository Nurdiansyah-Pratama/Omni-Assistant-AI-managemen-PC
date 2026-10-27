import {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  screen,
} from "electron";
import fs from "node:fs";
import path from "node:path";
import {
  analyzeScreenshot,
  type VisionMode,
} from "./vision";
import {
  requestAiChat,
} from "./ai/ai_router";
import type { AiProvider } from "./ai/base_provider";
import {
  getPublicVisionSettings,
  getVisionSettings,
  removeProviderApiKey,
  saveVisionSettings,
  testVisionProvider,
} from "./visionSettings";
import {
  getAutomationSettings,
  getSystemStatus,
  freeUpMemory,
  initializeSystemControl,
  openMyAsus,
  openSamsungMagicianApp,
  saveAutomationSettings,
  setBatteryMode,
  setFanMode,
  setSamsungMode,
  type AutomationSettings,
  type BatteryMode,
  type FanMode,
} from "./systemControl";
import type { SamsungMode } from "./samsungMagician";
import {
  exportDashboardMemory,
  forgetDashboardMemory,
  getDashboardSnapshot,
  importDashboardMemory,
  initializeDashboardAutomation,
  setDashboardManualProfile,
  updateDashboardPreference,
  updateDashboardSafety,
} from "./dashboard_ui";
import {
  initializeLocalApiServer,
  stopLocalApiServer,
} from "./local_api_server";

const COMPACT_SIZE = { width: 280, height: 220 };
const EXPANDED_SIZE = { width: 400, height: 600 };
const SCREEN_MARGIN = 16;

// Optimasi performa grafis GPU dan batas memori V8
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("js-flags", "--max-old-space-size=256");

let assistantWindow: BrowserWindow | null = null;
let compactPosition: { x: number; y: number } | null = null;
let isExpanded = false;

function getDefaultWindowPosition(width: number, height: number) {
  const { workArea } = screen.getPrimaryDisplay();

  return {
    x: workArea.x + workArea.width - width - SCREEN_MARGIN,
    y: workArea.y + workArea.height - height - SCREEN_MARGIN,
  };
}

function getPositionFile() {
  return path.join(app.getPath("userData"), "window-position.json");
}

function loadWindowPosition() {
  try {
    const position = JSON.parse(
      fs.readFileSync(getPositionFile(), "utf8"),
    ) as { x?: unknown; y?: unknown };

    if (typeof position.x === "number" && typeof position.y === "number") {
      compactPosition = { x: position.x, y: position.y };
    }
  } catch {
    compactPosition = null;
  }
}

function saveWindowPosition() {
  if (!compactPosition) return;

  try {
    fs.writeFileSync(getPositionFile(), JSON.stringify(compactPosition));
  } catch {
    // Position persistence should never prevent the assistant from running.
  }
}

function clampToDisplay(
  position: { x: number; y: number },
  size: { width: number; height: number },
) {
  const display = screen.getDisplayNearestPoint(position);
  const { workArea } = display;

  return {
    x: Math.min(
      Math.max(position.x, workArea.x),
      workArea.x + workArea.width - size.width,
    ),
    y: Math.min(
      Math.max(position.y, workArea.y),
      workArea.y + workArea.height - size.height,
    ),
  };
}

function resizeAssistantWindow(expanded: boolean) {
  if (!assistantWindow) return;

  isExpanded = expanded;
  const size = expanded ? EXPANDED_SIZE : COMPACT_SIZE;
  const compactBounds =
    compactPosition ??
    getDefaultWindowPosition(COMPACT_SIZE.width, COMPACT_SIZE.height);
  const position = expanded
    ? clampToDisplay(
        {
          x: compactBounds.x + COMPACT_SIZE.width - EXPANDED_SIZE.width,
          y: compactBounds.y + COMPACT_SIZE.height - EXPANDED_SIZE.height,
        },
        size,
      )
    : clampToDisplay(compactBounds, size);

  assistantWindow.setBounds({ ...size, ...position }, true);
}

function createAssistantWindow() {
  loadWindowPosition();
  const position = clampToDisplay(
    compactPosition ??
      getDefaultWindowPosition(COMPACT_SIZE.width, COMPACT_SIZE.height),
    COMPACT_SIZE,
  );
  compactPosition = position;

  assistantWindow = new BrowserWindow({
    ...COMPACT_SIZE,
    ...position,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  assistantWindow.setAlwaysOnTop(true, "floating");
  assistantWindow.on("moved", () => {
    if (!assistantWindow || isExpanded) return;
    const [x, y] = assistantWindow.getPosition();
    compactPosition = { x, y };
    saveWindowPosition();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    void assistantWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    void assistantWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  assistantWindow.on("closed", () => {
    assistantWindow = null;
  });
}

app.whenReady().then(() => {
  initializeSystemControl();
  initializeDashboardAutomation();
  initializeLocalApiServer();
  ipcMain.on("assistant:set-expanded", (_event, expanded: boolean) => {
    resizeAssistantWindow(expanded);
  });

  ipcMain.on("assistant:close", () => {
    assistantWindow?.close();
  });

  ipcMain.handle(
    "assistant:analyze-screen",
    async (
      _event,
      input?: { mode?: VisionMode; userPrompt?: string },
    ) => {
      const cursorPoint = screen.getCursorScreenPoint();
      const display = screen.getDisplayNearestPoint(cursorPoint);
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: display.size,
        fetchWindowIcons: false,
      });
      const source =
        sources.find((item) => item.display_id === String(display.id)) ??
        sources[0];

      if (!source) {
        throw new Error("Tidak dapat mengambil snapshot layar.");
      }

      const mode: VisionMode =
        input?.mode === "coding" || input?.mode === "design"
          ? input.mode
          : "general";
      const visionSettings = getVisionSettings();
      const result = await analyzeScreenshot({
        image: source.thumbnail,
        mode,
        userPrompt: input?.userPrompt,
        settings: visionSettings,
      });

      return {
        capturedAt: new Date().toISOString(),
        displayName: source.name,
        width: display.size.width,
        height: display.size.height,
        provider: result.provider,
        analysis: result.analysis,
      };
    },
  );

  ipcMain.handle("system:get-status", () => getSystemStatus());
  ipcMain.handle("system:get-settings", () => getAutomationSettings());
  ipcMain.handle("system:free-memory", () => freeUpMemory());
  ipcMain.handle(
    "system:save-settings",
    (_event, input: AutomationSettings) =>
      saveAutomationSettings(input),
  );
  ipcMain.handle("system:set-fan-mode", (_event, mode: FanMode) =>
    setFanMode(mode),
  );
  ipcMain.handle(
    "system:set-battery-mode",
    (_event, mode: BatteryMode) => setBatteryMode(mode),
  );
  ipcMain.handle("system:open-myasus", () => openMyAsus());
  ipcMain.handle("system:open-samsung-magician", () =>
    openSamsungMagicianApp(),
  );
  ipcMain.handle(
    "system:set-samsung-mode",
    (_event, mode: SamsungMode) => setSamsungMode(mode),
  );

  ipcMain.handle("assistant:get-vision-settings", () =>
    getPublicVisionSettings(),
  );

  ipcMain.handle("assistant:save-vision-settings", (_event, input) =>
    saveVisionSettings(input),
  );

  ipcMain.handle("assistant:remove-provider-api-key", (_event, provider: AiProvider) =>
    removeProviderApiKey(provider),
  );

  ipcMain.handle("assistant:test-provider", (_event, provider: AiProvider) =>
    testVisionProvider(provider),
  );

  ipcMain.handle(
    "assistant:chat",
    (_event, input: unknown) =>
      requestAiChat(
        input && typeof input === "object" && "messages" in input
          ? (input as {
              messages: unknown;
              mode?: VisionMode;
              focus?: string;
            })
          : { messages: input },
      ),
  );

  ipcMain.handle("dashboard:get-snapshot", () => getDashboardSnapshot());
  ipcMain.handle("dashboard:update-safety", (_event, input) =>
    updateDashboardSafety(input),
  );
  ipcMain.handle("dashboard:set-manual-profile", (_event, profileName) =>
    setDashboardManualProfile(profileName),
  );
  ipcMain.handle("dashboard:update-preference", (_event, input) =>
    updateDashboardPreference(input),
  );
  ipcMain.handle("dashboard:forget-memory", () => forgetDashboardMemory());
  ipcMain.handle("dashboard:export-memory", () => exportDashboardMemory());
  ipcMain.handle("dashboard:import-memory", () => importDashboardMemory());

  createAssistantWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createAssistantWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    stopLocalApiServer();
    app.quit();
  }
});
