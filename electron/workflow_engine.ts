import { readBundledConfig } from "./config";
import type { SystemContext } from "./context_monitor";
import { addWorkflowHistory } from "./memory_manager";
import {
  runAutomationAction,
  type AutomationActionName,
} from "./automation_actions";
import { checkAction, markActionResult } from "./safety_guard";

export interface WorkflowRule {
  name: string;
  trigger: {
    activeProcess?: string;
    activeProcessesAll?: string[];
    detectedActivity?: string;
    fullscreen?: boolean;
  };
  conditions: {
    ramUsageGreaterThan?: number;
    cpuTempGreaterThan?: number;
    gpuUsageGreaterThan?: number;
    batteryBelowPercent?: number;
    batteryState?: string;
  };
  actions: AutomationActionName[];
  cooldownSeconds: number;
  notification?: string;
}

export interface WorkflowRunLog {
  workflow: string;
  action: string;
  result: string;
  confidence: number;
  risk: "low" | "medium" | "high";
  createdAt: string;
}

const fallbackWorkflows: WorkflowRule[] = [];
let workflowLogs: WorkflowRunLog[] = [];

function normalize(name: string) {
  return name.toLowerCase().replace(/\.exe$/i, "");
}

function processSet(context: SystemContext) {
  return new Set(context.runningProcesses.map((process) => normalize(process.name)));
}

function matchesWorkflow(rule: WorkflowRule, context: SystemContext) {
  const processes = processSet(context);
  if (
    rule.trigger.activeProcess &&
    normalize(rule.trigger.activeProcess) !== normalize(context.activeApp)
  ) {
    return false;
  }
  if (
    rule.trigger.activeProcessesAll?.some(
      (item) => !processes.has(normalize(item)),
    )
  ) {
    return false;
  }
  if (
    rule.trigger.detectedActivity &&
    rule.trigger.detectedActivity !== context.detectedActivity
  ) {
    return false;
  }
  if (
    rule.trigger.fullscreen !== undefined &&
    rule.trigger.fullscreen !== context.isFullscreen
  ) {
    return false;
  }
  if (
    rule.conditions.ramUsageGreaterThan !== undefined &&
    context.ramUsage <= rule.conditions.ramUsageGreaterThan
  ) {
    return false;
  }
  if (
    rule.conditions.cpuTempGreaterThan !== undefined &&
    (context.cpuTemp ?? 0) <= rule.conditions.cpuTempGreaterThan
  ) {
    return false;
  }
  if (
    rule.conditions.gpuUsageGreaterThan !== undefined &&
    (context.gpuUsage ?? 0) <= rule.conditions.gpuUsageGreaterThan
  ) {
    return false;
  }
  if (
    rule.conditions.batteryState &&
    rule.conditions.batteryState !== context.batteryState
  ) {
    return false;
  }
  return true;
}

function workflowConfidence(rule: WorkflowRule, context: SystemContext) {
  let score = 0.55;
  const reasons: string[] = [];
  if (rule.trigger.detectedActivity === context.detectedActivity) {
    score += 0.18;
    reasons.push(`activity ${context.detectedActivity}`);
  }
  if (rule.trigger.fullscreen === context.isFullscreen) {
    score += 0.08;
    reasons.push(context.isFullscreen ? "fullscreen" : "windowed");
  }
  if (rule.conditions.ramUsageGreaterThan !== undefined) {
    score += Math.min(0.1, Math.max(0, context.ramUsage - rule.conditions.ramUsageGreaterThan) / 100);
    reasons.push(`RAM ${context.ramUsage}%`);
  }
  if (rule.conditions.cpuTempGreaterThan !== undefined) {
    score += Math.min(
      0.1,
      Math.max(0, (context.cpuTemp ?? 0) - rule.conditions.cpuTempGreaterThan) / 100,
    );
    reasons.push(`CPU ${context.cpuTemp ?? "-"} C`);
  }
  if (rule.conditions.gpuUsageGreaterThan !== undefined) {
    score += Math.min(
      0.1,
      Math.max(0, (context.gpuUsage ?? 0) - rule.conditions.gpuUsageGreaterThan) / 100,
    );
    reasons.push(`GPU ${context.gpuUsage ?? "-"}%`);
  }

  return {
    confidence: Math.max(0, Math.min(0.98, Number(score.toFixed(2)))),
    reasons,
  };
}

export function getWorkflowRules() {
  return readBundledConfig<WorkflowRule[]>("workflows.json", fallbackWorkflows);
}

export function getWorkflowLogs() {
  return workflowLogs;
}

export async function runWorkflows(context: SystemContext) {
  const matched = getWorkflowRules().filter((rule) =>
    matchesWorkflow(rule, context),
  );

  for (const workflow of matched) {
    const workflowAnalysis = workflowConfidence(workflow, context);
    for (const action of workflow.actions) {
      const risk =
        action === "setSSDPerformance" || action === "freeMemorySafe"
          ? "medium"
          : "low";
      const safety = checkAction({
        action,
        risk,
        cooldownSeconds: workflow.cooldownSeconds,
      });

      if (safety.status !== "allowed") {
        workflowLogs.push({
          workflow: workflow.name,
          action,
          result: `${safety.reason} Confidence ${Math.round(workflowAnalysis.confidence * 100)}%.`,
          confidence: workflowAnalysis.confidence,
          risk,
          createdAt: safety.createdAt,
        });
        addWorkflowHistory(workflow.name, safety.reason, "blocked");
        continue;
      }

      try {
        const result = await runAutomationAction(action, workflow.notification);
        markActionResult(action, "success", result);
        workflowLogs.push({
          workflow: workflow.name,
          action,
          result,
          confidence: workflowAnalysis.confidence,
          risk,
          createdAt: new Date().toISOString(),
        });
        addWorkflowHistory(workflow.name, result, "success");
      } catch (error) {
        const result =
          error instanceof Error ? error.message : "Action gagal.";
        markActionResult(action, "failed", result);
        workflowLogs.push({
          workflow: workflow.name,
          action,
          result,
          confidence: workflowAnalysis.confidence,
          risk,
          createdAt: new Date().toISOString(),
        });
        addWorkflowHistory(workflow.name, result, "failed");
      }
    }
  }

  workflowLogs = workflowLogs.slice(-200);
  return workflowLogs;
}
