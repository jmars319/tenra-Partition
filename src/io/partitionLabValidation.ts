import { formatBytes } from "../domain/bytes";
import type { OperationPlan, SafetyReport } from "../domain/types";
import type { SimulationResult } from "../simulation/simulator";
import type { PartitionLabValidationRequest, PartitionLabValidationResult } from "./partitionLabTypes";

export function exportOperationPlan(plan: OperationPlan): string {
  return JSON.stringify(
    {
      schema: "tenra-partition.operation-plan.v1",
      exportedAt: new Date().toISOString(),
      plan,
    },
    null,
    2,
  );
}

export function exportSafetyReport(report: SafetyReport): string {
  return JSON.stringify(
    {
      schema: "tenra-partition.safety-report.v1",
      exportedAt: new Date().toISOString(),
      report,
    },
    null,
    2,
  );
}

export function createLabValidationResult(input: {
  sourceRequest: PartitionLabValidationRequest;
  reviewedPlan: OperationPlan;
  simulation: SimulationResult;
  executionDisabledReason: string;
}): PartitionLabValidationResult {
  const differences = compareRequestedPlanToReviewedPlan(input.sourceRequest.plan, input.reviewedPlan);
  if (input.sourceRequest.simulation.ok !== input.simulation.ok) {
    differences.push("Simulation pass/fail changed between request and review.");
  }
  if (input.sourceRequest.simulation.validation.summary !== input.simulation.validation.summary) {
    differences.push("Simulation validation summary changed between request and review.");
  }

  return {
    schema: "tenra-partition.lab-validation-result.v1",
    exportedAt: new Date().toISOString(),
    sourceRequest: input.sourceRequest,
    reviewedPlan: input.reviewedPlan,
    simulation: {
      ok: input.simulation.ok,
      validation: input.simulation.validation,
      disk: input.simulation.disk,
    },
    review: {
      status: input.simulation.ok && differences.length === 0 ? "reviewed" : "blocked",
      requestedPlanMatchesReviewedPlan: differences.length === 0,
      safetyPosture: input.reviewedPlan.safetyReport.level,
      differences,
      execution: {
        enabled: false,
        reason: input.executionDisabledReason,
      },
    },
  };
}

export function createGuardrailReviewFromLabResult(input: {
  result: PartitionLabValidationResult;
}) {
  const { result } = input;

  return {
    schema: "tenra-guardrail.external-action-review.v1",
    exportedAt: new Date().toISOString(),
    sourceApp: "partition",
    actionKind: "execute-system-change",
    actorLabel: "Partition lab validation",
    targetLabel: result.sourceRequest.plan.id,
    summary:
      result.review.status === "blocked"
        ? "Partition lab validation blocked a disk operation. Execution must remain disabled until Guardrail and a human operator review it."
        : "Partition lab validation reviewed a disk operation. Execution remains disabled in the local app.",
    evidence: [
      { label: "Review status", value: result.review.status },
      { label: "Safety posture", value: result.review.safetyPosture },
      { label: "Simulation", value: result.simulation.ok ? "passed" : "blocked" },
      {
        label: "Differences",
        value: result.review.differences.length ? result.review.differences.join("; ") : "none",
      },
    ],
    recommendedDecision: result.review.status === "blocked" ? "deny" : "review",
    traceId: `partition-lab-${result.sourceRequest.plan.id}`,
  };
}

export function createHumanReadableSummary(plan: OperationPlan): string {
  const lines = [
    "tenra Partition operation summary",
    "",
    `Workflow: Give ${formatBytes(plan.requestedExpansionBytes)} from E: to C:`,
    `Status: ${plan.status}`,
    `Movement required: ${plan.requiresMovement ? "yes" : "no"}`,
    "",
    "Planner explanation:",
    plan.explanation,
    "",
    "Operation queue:",
    ...plan.operations.map(
      (operation, index) => `${index + 1}. ${operation.title} - ${operation.description}`,
    ),
    "",
    "Safety findings:",
    ...(plan.safetyReport.findings.length === 0
      ? ["No blocking findings for read-only simulation."]
      : plan.safetyReport.findings.map(
          (finding) => `${finding.severity.toUpperCase()}: ${finding.message}`,
        )),
    "",
    "Execution:",
    "Execution is not available until the integrated lab harness proves the operation against disposable images.",
  ];

  return lines.join("\n");
}

function compareRequestedPlanToReviewedPlan(
  requested: OperationPlan,
  reviewed: OperationPlan,
): string[] {
  const differences: string[] = [];

  if (requested.id !== reviewed.id) {
    differences.push("Plan id changed between request and review.");
  }
  if (requested.requestedExpansionBytes !== reviewed.requestedExpansionBytes) {
    differences.push("Requested expansion size changed between request and review.");
  }
  if (requested.operations.length !== reviewed.operations.length) {
    differences.push("Operation count changed between request and review.");
  }
  requested.operations.forEach((operation, index) => {
    const reviewedOperation = reviewed.operations[index];
    if (!reviewedOperation) return;
    if (operation.type !== reviewedOperation.type || operation.partitionId !== reviewedOperation.partitionId) {
      differences.push(`Operation ${index + 1} changed from ${operation.type} to ${reviewedOperation.type}.`);
    }
  });
  if (requested.safetyReport.level !== reviewed.safetyReport.level) {
    differences.push("Safety level changed between request and review.");
  }

  return differences;
}
