import {
  freeUpMemory,
  setFanMode,
  setSamsungMode,
  type FanMode,
} from "./systemControl";
import { showNotification } from "./notification_service";

export type AutomationActionName =
  | "setFanPerformance"
  | "setFanStandard"
  | "setSSDPerformance"
  | "setSSDBalanced"
  | "setSSDPowerSaving"
  | "freeMemorySafe"
  | "pauseBackgroundCleanup"
  | "showNotification";

export async function runAutomationAction(
  action: AutomationActionName,
  notificationMessage?: string,
) {
  switch (action) {
    case "setFanPerformance":
      await setFanMode("performance" as FanMode);
      return "Fan Performance diminta.";
    case "setFanStandard":
      await setFanMode("standard" as FanMode);
      return "Fan Standard diminta.";
    case "setSSDPerformance":
      return "SSD Performance membutuhkan konfirmasi manual; action dilewati.";
    case "setSSDBalanced":
      await setSamsungMode("balanced");
      return "SSD Balanced diminta.";
    case "setSSDPowerSaving":
      await setSamsungMode("power-saving");
      return "SSD Power Saving diminta.";
    case "freeMemorySafe":
      return (await freeUpMemory()).message;
    case "pauseBackgroundCleanup":
      return "Background cleanup dipause oleh workflow.";
    case "showNotification":
      showNotification("Omni Assistant", notificationMessage ?? "Workflow aktif.");
      return "Notifikasi ditampilkan.";
    default:
      return "Action tidak dikenal.";
  }
}
