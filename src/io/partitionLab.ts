import { Disk, OperationPlan, SafetyReport, ValidationResult } from "../domain/types";
import { formatBytes } from "../domain/bytes";

export interface PartitionLabDiskLayout {
  schema: "partition-lab.disk-layout.v1";
  capturedAt: string;
  source: string;
  disk: Disk;
}

export interface PartitionLabMetadata {
  schema: PartitionLabDiskLayout["schema"];
  capturedAt: string;
  source: string;
}

export interface PartitionLabValidationRequest {
  schema: "tenra-partition.lab-validation-request.v1";
  exportedAt: string;
  source: PartitionLabMetadata;
  requestedExpansionBytes: number;
  plan: OperationPlan;
  simulation: {
    ok: boolean;
    validation: ValidationResult;
  };
  execution: {
    enabled: false;
    reason: string;
  };
}

export function loadDiskFromPartitionLabExport(input: unknown): Disk {
  if (!isPartitionLabDiskLayout(input)) {
    throw new Error("Expected tenra Partition lab disk layout JSON with schema partition-lab.disk-layout.v1.");
  }

  return input.disk;
}

export function readPartitionLabMetadata(input: unknown): PartitionLabMetadata {
  if (!isPartitionLabDiskLayout(input)) {
    throw new Error("Expected tenra Partition lab disk layout JSON with schema partition-lab.disk-layout.v1.");
  }

  return {
    schema: input.schema,
    capturedAt: input.capturedAt,
    source: input.source,
  };
}

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

export function loadLabValidationRequest(input: unknown): PartitionLabValidationRequest {
  if (!isPartitionLabValidationRequest(input)) {
    throw new Error(
      "Expected read-only tenra Partition lab validation request JSON with schema tenra-partition.lab-validation-request.v1.",
    );
  }

  return input;
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

function isPartitionLabDiskLayout(input: unknown): input is PartitionLabDiskLayout {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PartitionLabDiskLayout>;
  return (
    candidate.schema === "partition-lab.disk-layout.v1" &&
    typeof candidate.capturedAt === "string" &&
    typeof candidate.source === "string" &&
    isDisk(candidate.disk)
  );
}

function isDisk(input: unknown): input is Disk {
  if (!input || typeof input !== "object") return false;
  const disk = input as Partial<Disk>;
  return (
    typeof disk.id === "string" &&
    typeof disk.name === "string" &&
    typeof disk.sizeBytes === "number" &&
    typeof disk.sectorSizeBytes === "number" &&
    typeof disk.alignmentBytes === "number" &&
    (disk.scheme === "GPT" || disk.scheme === "MBR") &&
    Array.isArray(disk.partitions)
  );
}

function isPartitionLabValidationRequest(input: unknown): input is PartitionLabValidationRequest {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PartitionLabValidationRequest>;
  return (
    candidate.schema === "tenra-partition.lab-validation-request.v1" &&
    typeof candidate.exportedAt === "string" &&
    candidate.source?.schema === "partition-lab.disk-layout.v1" &&
    typeof candidate.source.capturedAt === "string" &&
    typeof candidate.source.source === "string" &&
    typeof candidate.requestedExpansionBytes === "number" &&
    Boolean(candidate.plan && typeof candidate.plan === "object") &&
    typeof candidate.simulation?.ok === "boolean" &&
    Boolean(candidate.simulation.validation && typeof candidate.simulation.validation === "object") &&
    candidate.execution?.enabled === false &&
    typeof candidate.execution.reason === "string" &&
    candidate.execution.reason.length > 0
  );
}
