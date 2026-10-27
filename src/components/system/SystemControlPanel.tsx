import { useEffect, useState } from "react";
import type {
  AutomationSettings,
  BatteryMode,
  FanMode,
  SamsungMode,
  SystemStatus,
} from "../../types/systemControl";

interface SystemControlPanelProps {
  status: SystemStatus | null;
  settings: AutomationSettings;
  isBusy: boolean;
  error: string;
  onSaveSettings: (settings: AutomationSettings) => void;
  onSetFanMode: (mode: FanMode) => void;
  onSetBatteryMode: (mode: BatteryMode) => void;
  onFreeUpMemory: () => void;
  onOpenMyAsus: () => void;
  onSetSamsungMode: (mode: SamsungMode) => void;
  onOpenSamsungMagician: () => void;
  onClose: () => void;
}

export function SystemControlPanel({
  status,
  settings,
  isBusy,
  error,
  onSaveSettings,
  onSetFanMode,
  onSetBatteryMode,
  onFreeUpMemory,
  onOpenMyAsus,
  onSetSamsungMode,
  onOpenSamsungMagician,
  onClose,
}: SystemControlPanelProps) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => setDraft(settings), [settings]);

  const updateNumber = (
    key: keyof AutomationSettings,
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: Number(value),
    }));
  };

  return (
    <section className="max-h-[420px] overflow-y-auto border-b border-slate-200 bg-slate-50 px-4 py-3">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Kontrol Sistem
          </h2>
          <p className="text-[11px] text-slate-500">
            ASUS VivoBook dan Samsung SSD
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-200"
        >
          Tutup
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <StatusCard
          label="Suhu CPU/ACPI"
          value={
            status?.temperatureCelsius === null ||
            status?.temperatureCelsius === undefined
              ? "Tidak tersedia"
              : `${status.temperatureCelsius.toFixed(1)} C`
          }
          warning={
            (status?.temperatureCelsius ?? 0) >= draft.hotTemperature
          }
          detail={status?.temperatureSource}
        />
        <StatusCard
          label="RAM"
          value={
            status
              ? `${status.memoryUsedPercent}% · ${status.memoryAvailableMb} MB bebas`
              : "Membaca..."
          }
          warning={
            (status?.memoryUsedPercent ?? 0) >=
            draft.memoryWarningPercent
          }
          detail="Memori fisik Windows"
        />
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <StatusCard
          label="CPU Load"
          value={formatPercent(status?.cpuLoadPercent)}
          warning={(status?.cpuLoadPercent ?? 0) >= 90}
          detail={
            status?.hardwareMonitorConnected
              ? "LibreHardwareMonitor"
              : "Aktifkan WMI atau Remote Web Server"
          }
        />
        <StatusCard
          label="GPU"
          value={status?.gpuName ?? "Membaca..."}
          warning={(status?.gpuTemperatureCelsius ?? 0) >= 85}
          detail={formatGpuDetail(status)}
        />
        <StatusCard
          label="Fan"
          value={
            status?.fanRpm === null || status?.fanRpm === undefined
              ? "Tidak tersedia"
              : `${status.fanRpm.toFixed(0)} RPM`
          }
          warning={false}
          detail={status?.fanSource}
        />
        <StatusCard
          label="LHM"
          value={status?.hardwareMonitorConnected ? "Terhubung" : "Fallback"}
          warning={false}
          detail={status?.temperatureSource}
        />
      </div>

      <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-800">
              Samsung Magician
            </p>
            <p className="text-[10px] text-slate-500">
              {status?.samsungMagician.driveName ??
                (status?.samsungMagician.installed
                  ? "Mencari Samsung SSD..."
                  : "Tidak terpasang")}
            </p>
          </div>
          <span className="rounded-full bg-white px-2 py-1 text-[9px] font-semibold text-blue-700">
            {formatSamsungMode(status?.samsungMagician.currentMode)}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <StatusCard
            label="Suhu SSD"
            value={
              status?.samsungMagician.temperatureCelsius === null ||
              status?.samsungMagician.temperatureCelsius === undefined
                ? "Tidak tersedia"
                : `${status.samsungMagician.temperatureCelsius.toFixed(1)} C`
            }
            warning={
              (status?.samsungMagician.temperatureCelsius ?? 0) >=
              draft.samsungMaxPerformanceTemperature
            }
            detail={
              status?.samsungMagician.warningTemperatureCelsius
                ? `Warning ${status.samsungMagician.warningTemperatureCelsius.toFixed(0)} C`
                : "LibreHardwareMonitor NVMe"
            }
          />
          <StatusCard
            label="Beban SSD"
            value={formatPercent(
              status?.samsungMagician.activityPercent,
            )}
            warning={
              (status?.samsungMagician.activityPercent ?? 0) >=
              draft.samsungHighLoadPercent
            }
            detail={formatStorageThroughput(status)}
          />
        </div>

        <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
          Rekomendasi:{" "}
          <strong>
            {formatSamsungMode(
              status?.samsungMagician.recommendedMode,
            )}
          </strong>
          . {status?.samsungMagician.recommendationReason}
        </p>

        <label className="mt-2 flex items-center justify-between rounded-lg bg-white p-2">
          <span>
            <span className="block text-[10px] font-semibold text-slate-700">
              Optimasi SSD otomatis
            </span>
            <span className="block text-[9px] text-slate-400">
              Cooldown 30 menit dan beban harus bertahan.
            </span>
          </span>
          <input
            type="checkbox"
            checked={draft.samsungAutomationEnabled}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                samsungAutomationEnabled: event.target.checked,
              }))
            }
            className="h-4 w-4 accent-blue-600"
          />
        </label>

        <label className="mt-2 flex items-center justify-between rounded-lg bg-white p-2">
          <span>
            <span className="block text-[10px] font-semibold text-slate-700">
              Notifikasi mode Performance
            </span>
            <span className="block text-[9px] text-slate-400">
              Beri tahu saat beban kerja layak memakai Performance.
            </span>
          </span>
          <input
            type="checkbox"
            checked={draft.samsungPerformanceNotificationsEnabled}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                samsungPerformanceNotificationsEnabled:
                  event.target.checked,
              }))
            }
            className="h-4 w-4 accent-blue-600"
          />
        </label>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <NumberField
            label="Beban tinggi"
            value={draft.samsungHighLoadPercent}
            suffix="%"
            onChange={(value) =>
              updateNumber("samsungHighLoadPercent", value)
            }
          />
          <NumberField
            label="Idle"
            value={draft.samsungIdleLoadPercent}
            suffix="%"
            onChange={(value) =>
              updateNumber("samsungIdleLoadPercent", value)
            }
          />
          <NumberField
            label="Suhu maks"
            value={draft.samsungMaxPerformanceTemperature}
            suffix="C"
            onChange={(value) =>
              updateNumber(
                "samsungMaxPerformanceTemperature",
                value,
              )
            }
          />
        </div>

        <ControlGroup label="Atur mode manual">
          <ControlButton
            active={
              status?.samsungMagician.currentMode === "performance"
            }
            disabled={
              isBusy ||
              !status?.samsungMagician.installed ||
              !status?.samsungMagician.serviceRunning
            }
            onClick={() => onSetSamsungMode("performance")}
          >
            Performance
          </ControlButton>
          <ControlButton
            active={status?.samsungMagician.currentMode === "balanced"}
            disabled={
              isBusy ||
              !status?.samsungMagician.installed ||
              !status?.samsungMagician.serviceRunning
            }
            onClick={() => onSetSamsungMode("balanced")}
          >
            Balanced
          </ControlButton>
          <ControlButton
            active={
              status?.samsungMagician.currentMode === "power-saving"
            }
            disabled={
              isBusy ||
              !status?.samsungMagician.installed ||
              !status?.samsungMagician.serviceRunning
            }
            onClick={() => onSetSamsungMode("power-saving")}
          >
            Hemat
          </ControlButton>
        </ControlGroup>

        {status?.samsungMagician.restartMayBeRequired && (
          <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[9px] text-amber-700">
            Mode Performance telah diminta. Samsung Magician mungkin meminta
            restart Windows untuk mengaktifkannya sepenuhnya.
          </p>
        )}

        <button
          type="button"
          disabled={isBusy || !status?.samsungMagician.installed}
          onClick={onOpenSamsungMagician}
          className="mt-2 w-full rounded-lg border border-blue-200 bg-white py-2 text-[10px] font-semibold text-blue-700 disabled:opacity-50"
        >
          Buka Samsung Magician
        </button>
      </div>

      <label className="mt-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
        <span>
          <span className="block text-xs font-semibold text-slate-800">
            Fan otomatis
          </span>
          <span className="block text-[10px] text-slate-500">
            Performance saat panas, Standard setelah normal.
          </span>
        </span>
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              enabled: event.target.checked,
            }))
          }
          className="h-4 w-4 accent-indigo-600"
        />
      </label>

      <label className="mt-2 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
        <span>
          <span className="block text-xs font-semibold text-slate-800">
            Ringankan RAM otomatis
          </span>
          <span className="block text-[10px] text-slate-500">
            Trim proses background besar saat RAM melewati ambang.
          </span>
        </span>
        <input
          type="checkbox"
          checked={draft.memoryCleanupEnabled}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              memoryCleanupEnabled: event.target.checked,
            }))
          }
          className="h-4 w-4 accent-indigo-600"
        />
      </label>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <NumberField
          label="Panas"
          value={draft.hotTemperature}
          suffix="C"
          onChange={(value) => updateNumber("hotTemperature", value)}
        />
        <NumberField
          label="Normal"
          value={draft.normalTemperature}
          suffix="C"
          onChange={(value) => updateNumber("normalTemperature", value)}
        />
        <NumberField
          label="RAM cleanup"
          value={draft.memoryWarningPercent}
          suffix="%"
          onChange={(value) => updateNumber("memoryWarningPercent", value)}
        />
      </div>

      <button
        type="button"
        disabled={isBusy}
        onClick={() => onSaveSettings(draft)}
        className="mt-2 w-full rounded-lg bg-slate-900 py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        Simpan otomatisasi
      </button>

      <button
        type="button"
        disabled={isBusy}
        onClick={onFreeUpMemory}
        className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 py-2 text-xs font-semibold text-indigo-700 disabled:opacity-60"
      >
        Ringankan RAM sekarang
      </button>

      <ControlGroup label={`Fan: ${status?.fanMode ?? "-"}`}>
        <ControlButton
          active={status?.fanMode === "standard"}
          disabled={isBusy}
          onClick={() => onSetFanMode("standard")}
        >
          Standard
        </ControlButton>
        <ControlButton
          active={status?.fanMode === "performance"}
          disabled={isBusy}
          onClick={() => onSetFanMode("performance")}
        >
          Performance
        </ControlButton>
      </ControlGroup>

      <ControlGroup label={`Battery: ${status?.batteryMode ?? "-"}`}>
        <ControlButton
          active={status?.batteryMode === "full"}
          disabled={isBusy}
          onClick={() => onSetBatteryMode("full")}
        >
          100%
        </ControlButton>
        <ControlButton
          active={status?.batteryMode === "balanced"}
          disabled={isBusy}
          onClick={() => onSetBatteryMode("balanced")}
        >
          80%
        </ControlButton>
        <ControlButton
          active={status?.batteryMode === "lifespan"}
          disabled={isBusy}
          onClick={() => onSetBatteryMode("lifespan")}
        >
          60%
        </ControlButton>
      </ControlGroup>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold text-slate-700">
          Pemakai RAM terbesar
        </p>
        <div className="mt-1 space-y-1">
          {status?.topMemoryProcesses.map((process, index) => (
            <div
              key={`${process.name}-${index}`}
              className="flex justify-between text-[10px] text-slate-500"
            >
              <span className="truncate">{process.name}</span>
              <span>{process.memoryMb} MB</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
          Omni tidak menutup aplikasi. Pembersihan hanya memangkas working set
          proses background besar dan dapat membuat aplikasi sedikit lambat
          saat datanya dimuat kembali.
        </p>
      </div>

      {(error || status?.lastError) && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-[10px] text-red-600">
          {error || status?.lastError}
        </p>
      )}
      <p className="mt-2 text-[10px] text-slate-500">
        {status?.lastAction}
      </p>
      <button
        type="button"
        disabled={isBusy}
        onClick={onOpenMyAsus}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700"
      >
        Buka MyASUS
      </button>
    </section>
  );
}

function StatusCard({
  label,
  value,
  warning,
  detail,
}: {
  label: string;
  value: string;
  warning: boolean;
  detail?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        warning
          ? "border-amber-300 bg-amber-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="mt-1 text-xs font-semibold text-slate-800">{value}</p>
      {detail && (
        <p className="mt-1 text-[9px] leading-tight text-slate-400">
          {detail}
        </p>
      )}
    </div>
  );
}

function formatPercent(value: number | null | undefined) {
  return value === null || value === undefined
    ? "Tidak tersedia"
    : `${value.toFixed(0)}%`;
}

function formatGpuDetail(status: SystemStatus | null) {
  if (!status) return undefined;

  const load =
    status.gpuLoadPercent === null
      ? "Load tidak tersedia"
      : `Load ${status.gpuLoadPercent.toFixed(0)}%`;
  const memory =
    status.gpuSharedMemoryUsedMb === null ||
    status.gpuSharedMemoryTotalMb === null
      ? null
      : `Shared ${formatMemory(status.gpuSharedMemoryUsedMb)} / ${formatMemory(status.gpuSharedMemoryTotalMb)}`;
  const temperature =
    status.gpuTemperatureCelsius === null
      ? "Suhu tidak diekspos GPU"
      : `${status.gpuTemperatureCelsius.toFixed(1)} C`;

  return [load, memory, temperature].filter(Boolean).join(" · ");
}

function formatMemory(valueMb: number) {
  return valueMb >= 1024
    ? `${(valueMb / 1024).toFixed(1)} GB`
    : `${valueMb.toFixed(0)} MB`;
}

function formatSamsungMode(mode: SamsungMode | undefined) {
  if (mode === "performance") return "Performance";
  if (mode === "balanced") return "Balanced";
  if (mode === "power-saving") return "Power Saving";
  if (mode === "custom") return "Custom";
  return "Tidak diketahui";
}

function formatStorageThroughput(status: SystemStatus | null) {
  if (!status) return undefined;

  const read = formatRate(
    status.samsungMagician.readBytesPerSecond,
  );
  const write = formatRate(
    status.samsungMagician.writeBytesPerSecond,
  );
  return `Read ${read} / Write ${write}`;
}

function formatRate(value: number | null) {
  if (value === null) return "-";
  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB/s`;
  }
  return `${(value / 1024).toFixed(0)} KB/s`;
}

function NumberField({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-[10px] text-slate-500">
      {label}
      <span className="mt-1 flex rounded-lg border border-slate-200 bg-white">
        <input
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-xs text-slate-800 outline-none"
        />
        <span className="px-1.5 py-1.5 text-[10px] text-slate-400">
          {suffix}
        </span>
      </span>
    </label>
  );
}

function ControlGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <p className="mb-1 text-[11px] font-semibold text-slate-700">
        {label}
      </p>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function ControlButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 rounded-lg border px-2 py-2 text-[10px] font-semibold ${
        active
          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
          : "border-slate-200 bg-white text-slate-600"
      } disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
