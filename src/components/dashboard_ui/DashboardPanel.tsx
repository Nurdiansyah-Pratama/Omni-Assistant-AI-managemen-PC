import type { DashboardSnapshot, SafetySettings } from "../../types/dashboard";

interface DashboardPanelProps {
  snapshot: DashboardSnapshot | null;
  error: string;
  isBusy: boolean;
  onUpdateSafety: (input: Partial<SafetySettings>) => void;
  onSetManualProfile: (profileName: string | null) => void;
  onExportMemory: () => void;
  onImportMemory: () => void;
  onForgetMemory: () => void;
  onClose: () => void;
}

export function DashboardPanel({
  snapshot,
  error,
  isBusy,
  onUpdateSafety,
  onSetManualProfile,
  onExportMemory,
  onImportMemory,
  onForgetMemory,
  onClose,
}: DashboardPanelProps) {
  const context = snapshot?.context;
  const profile = snapshot?.profile?.activeProfile;
  const profileEvaluation = snapshot?.profile;
  const safety = snapshot?.safety;
  const decisionSummary = snapshot?.decisionSummary;

  return (
    <section className="max-h-[430px] overflow-y-auto border-b border-slate-200 bg-slate-50 px-4 py-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Automation Dashboard
          </h2>
          <p className="text-[11px] text-slate-500">
            Context, profile, workflow, safety, dan memory lokal.
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
        <Metric label="Profil aktif" value={profile?.name ?? "Membaca..."} />
        <Metric
          label="Kandidat"
          value={profileEvaluation?.candidateProfile?.name ?? "-"}
        />
        <Metric label="Activity" value={context?.detectedActivity ?? "-"} />
        <Metric label="App aktif" value={context?.activeApp || "-"} />
        <Metric
          label="Window"
          value={context?.activeWindowTitle || "-"}
          small
        />
        <Metric label="CPU" value={`${context?.cpuUsage ?? 0}%`} />
        <Metric
          label="CPU Temp"
          value={
            context?.cpuTemp === null || context?.cpuTemp === undefined
              ? "-"
              : `${context.cpuTemp.toFixed(1)} C`
          }
        />
        <Metric
          label="GPU"
          value={
            context?.gpuUsage === null || context?.gpuUsage === undefined
              ? "-"
              : `${context.gpuUsage.toFixed(0)}%`
          }
        />
        <Metric label="RAM" value={`${context?.ramUsage ?? 0}%`} />
        <Metric
          label="SSD"
          value={
            context?.ssdUsage === null || context?.ssdUsage === undefined
              ? "-"
              : `${context.ssdUsage.toFixed(0)}%`
          }
        />
        <Metric label="Battery" value={context?.batteryState ?? "-"} />
        <Metric
          label="Confidence"
          value={`${Math.round((profileEvaluation?.activeProfileConfidence ?? 0) * 100)}%`}
        />
        <Metric
          label="Stability"
          value={`${Math.round((profileEvaluation?.profileStabilityScore ?? 0) * 100)}%`}
        />
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-slate-700">
            AI Reasoning
          </p>
          <span className="rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-semibold text-indigo-600">
            Quality {decisionSummary?.automationQualityScore ?? "-"}
          </span>
        </div>
        <p className="mt-1 text-[10px] text-slate-500">
          {profileEvaluation?.reason ?? "Menunggu analisis context..."}
        </p>
        <div className="mt-2 space-y-2">
          {decisionSummary?.decisions.slice(0, 4).map((decision) => (
            <div
              key={decision.decision_id}
              className="rounded-lg border border-slate-100 bg-slate-50 p-2"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-semibold text-slate-700">
                  {decision.title}
                </p>
                <RiskBadge risk={decision.risk} />
              </div>
              <p className="mt-1 text-[9px] text-slate-500">
                Confidence {Math.round(decision.confidence * 100)}% -{" "}
                {decision.rollback_available
                  ? "Rollback tersedia"
                  : "Rollback tidak tersedia"}
              </p>
              <ul className="mt-1 space-y-0.5">
                {decision.reason.slice(0, 3).map((reason) => (
                  <li
                    key={reason}
                    className="truncate text-[9px] text-slate-500"
                    title={reason}
                  >
                    - {reason}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {safety && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Toggle
            label="Pause"
            checked={safety.paused}
            disabled={isBusy}
            onChange={(checked) => onUpdateSafety({ paused: checked })}
          />
          <Toggle
            label="Dry-run"
            checked={safety.dryRun}
            disabled={isBusy}
            onChange={(checked) => onUpdateSafety({ dryRun: checked })}
          />
          <Toggle
            label="Manual"
            checked={safety.manualOverride}
            disabled={isBusy}
            onChange={(checked) =>
              onUpdateSafety({ manualOverride: checked })
            }
          />
        </div>
      )}

      <label className="mt-3 block text-[11px] font-semibold text-slate-700">
        Manual profile
        <select
          value={profile?.name ?? ""}
          disabled={isBusy}
          onChange={(event) =>
            onSetManualProfile(event.target.value || null)
          }
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700 outline-none"
        >
          <option value="">Auto</option>
          {snapshot?.profiles.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold text-slate-700">
          Memory insight
        </p>
        <p className="mt-1 text-[10px] text-slate-500">
          Apps: {snapshot?.memoryInsights.topApps.join(", ") || "-"}
        </p>
        <p className="mt-1 text-[10px] text-slate-500">
          Profiles: {snapshot?.memoryInsights.topProfiles.join(", ") || "-"}
        </p>
        <p className="mt-1 text-[10px] text-slate-500">
          Avg CPU: {snapshot?.memoryInsights.averageCpuTemp ?? "-"} C - Avg
          RAM: {snapshot?.memoryInsights.averageRamUsage ?? "-"}%
        </p>
        <InsightList
          items={snapshot?.memoryInsights.behaviorInsights}
          empty="Belum ada pola kebiasaan yang cukup kuat."
        />
        <div className="mt-2 grid grid-cols-3 gap-2">
          <SmallButton disabled={isBusy} onClick={onExportMemory}>
            Export
          </SmallButton>
          <SmallButton disabled={isBusy} onClick={onImportMemory}>
            Import
          </SmallButton>
          <SmallButton disabled={isBusy} onClick={onForgetMemory}>
            Forget
          </SmallButton>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold text-slate-700">
          Workflow rules
        </p>
        <div className="mt-1 space-y-1">
          {snapshot?.workflows.slice(0, 6).map((workflow) => (
            <p key={workflow.name} className="text-[10px] text-slate-500">
              {workflow.name}: {workflow.actions.join(", ")}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold text-slate-700">
          Predictive insight
        </p>
        <InsightList
          items={[
            ...(decisionSummary?.predictiveInsights ?? []),
            ...(snapshot?.memoryInsights.predictiveInsights ?? []),
          ].slice(0, 5)}
          empty="Belum cukup data untuk prediksi."
        />
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold text-slate-700">
          Self optimization
        </p>
        <InsightList
          items={[
            ...(decisionSummary?.optimizationRecommendations ?? []),
            ...(snapshot?.memoryInsights.optimizationRecommendations ?? []),
          ].slice(0, 5)}
          empty="Belum ada rekomendasi threshold."
        />
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold text-slate-700">
          Log terbaru
        </p>
        <div className="mt-1 space-y-1">
          {snapshot?.actionLogs.slice(-8).reverse().map((log) => (
            <p
              key={`${log.createdAt}-${log.action}`}
              className="text-[10px] text-slate-500"
            >
              [{log.status}] {log.action}: {log.reason}
            </p>
          ))}
        </div>
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 p-2 text-[10px] text-red-600">
          {error}
        </p>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p
        className={`mt-1 truncate font-semibold text-slate-800 ${
          small ? "text-[10px]" : "text-xs"
        }`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function RiskBadge({ risk }: { risk: "low" | "medium" | "high" }) {
  const className =
    risk === "high"
      ? "bg-red-50 text-red-600"
      : risk === "medium"
        ? "bg-amber-50 text-amber-600"
        : "bg-emerald-50 text-emerald-600";

  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${className}`}>
      {risk}
    </span>
  );
}

function InsightList({
  items,
  empty,
}: {
  items?: string[];
  empty: string;
}) {
  const visibleItems = items?.filter(Boolean) ?? [];
  if (visibleItems.length === 0) {
    return <p className="mt-1 text-[10px] text-slate-400">{empty}</p>;
  }

  return (
    <div className="mt-1 space-y-1">
      {visibleItems.map((item) => (
        <p key={item} className="text-[10px] text-slate-500">
          {item}
        </p>
      ))}
    </div>
  );
}

function Toggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-2 text-[10px] font-semibold text-slate-700">
      {label}
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-indigo-600"
      />
    </label>
  );
}

function SmallButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-[10px] font-semibold text-slate-700 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
