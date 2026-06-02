import type { Disk } from "../domain/types";
import type {
  PartitionGuardrailDecision,
  PartitionLabArtifact,
  PartitionLabBatchReport,
  PartitionLabCapabilities,
  PartitionLabCommandPlan,
  PartitionLabDiskLayout,
  PartitionLabGeometryLayout,
  PartitionLabGeometryPartition,
  PartitionLabGeometryRun,
  PartitionLabMacGate,
  PartitionLabMetadata,
  PartitionLabValidationRequest,
  PartitionLabValidationResult,
  PartitionLabVerifyResult,
  PartitionLabVmPlan,
  PartitionLabWindowsHandoff,
} from "./partitionLabTypes";

export function loadDiskFromPartitionLabExport(input: unknown): Disk {
  if (isPartitionLabDiskLayout(input)) return input.disk;
  if (isPartitionLabGeometryLayout(input)) return diskFromGeometryLayout(input);
  throw new Error(
    "Expected tenra Partition lab disk layout JSON with schema partition-lab.disk-layout.v1 or partition-lab.layout.v1.",
  );
}

export function readPartitionLabMetadata(input: unknown): PartitionLabMetadata {
  if (isPartitionLabDiskLayout(input)) {
    return {
      schema: input.schema,
      capturedAt: input.capturedAt,
      source: input.source,
    };
  }
  if (isPartitionLabGeometryLayout(input)) {
    return {
      schema: input.schema,
      capturedAt: new Date().toISOString(),
      source: input.image?.path ?? input.disk.path ?? `tenra Partition Lab ${input.scenario ?? "layout"}`,
    };
  }
  throw new Error(
    "Expected tenra Partition lab disk layout JSON with schema partition-lab.disk-layout.v1 or partition-lab.layout.v1.",
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

export function loadLabValidationResult(input: unknown): PartitionLabValidationResult {
  if (!isPartitionLabValidationResult(input)) {
    throw new Error(
      "Expected tenra Partition lab validation result JSON with schema tenra-partition.lab-validation-result.v1.",
    );
  }
  return input;
}

export function loadPartitionGuardrailDecision(input: unknown): PartitionGuardrailDecision {
  if (!isPartitionGuardrailDecision(input)) {
    throw new Error("Expected Guardrail decision JSON returnable to tenra Partition.");
  }
  return input;
}

export function loadPartitionLabArtifact(input: unknown): PartitionLabArtifact {
  if (isPartitionLabCapabilities(input)) return input;
  if (isPartitionLabCommandPlan(input)) return input;
  if (isPartitionLabGeometryRun(input)) return input;
  if (isPartitionLabVerifyResult(input)) return input;
  if (isPartitionLabBatchReport(input)) return input;
  if (isPartitionLabVmPlan(input)) return input;
  if (isPartitionLabMacGate(input)) return input;
  if (isPartitionLabWindowsHandoff(input)) return input;
  throw new Error("Expected Partition Lab artifact JSON.");
}

function diskFromGeometryLayout(layout: PartitionLabGeometryLayout): Disk {
  const sectorSizeBytes = layout.disk.sector_size;
  const alignmentBytes = layout.disk.alignment_sectors * sectorSizeBytes;
  const scheme = layout.disk.label.toLowerCase() === "gpt" ? "GPT" : "MBR";
  const id = layout.disk.id ?? layout.image?.image_id ?? layout.scenario ?? "lab-raw-image";

  return {
    id,
    name: layout.scenario ?? layout.disk.path ?? "Lab raw image",
    sizeBytes: layout.disk.size_bytes,
    sectorSizeBytes,
    alignmentBytes,
    scheme,
    partitions: layout.disk.partitions.map((partition) =>
      partitionFromGeometryLayout(partition, sectorSizeBytes, alignmentBytes),
    ),
  };
}

function partitionFromGeometryLayout(
  partition: PartitionLabGeometryPartition,
  sectorSizeBytes: number,
  alignmentBytes: number,
) {
  const label = partition.label ?? partition.name ?? `Partition ${partition.number}`;
  const startByte = partition.start_sector * sectorSizeBytes;
  const sizeBytes = (partition.end_sector - partition.start_sector + 1) * sectorSizeBytes;
  const usedBytes = partition.used_bytes ?? Math.max(0, sizeBytes - (partition.free_bytes ?? 0));
  const minimumSizeBytes =
    partition.minimum_size_bytes ?? Math.min(sizeBytes, usedBytes + alignmentBytes);

  return {
    id: `lab-part-${partition.number}-${label.toLowerCase()}`,
    number: partition.number,
    name: partition.name ?? label,
    letter: /^[A-Za-z]$/.test(label) ? label.toUpperCase() : undefined,
    startByte,
    sizeBytes,
    filesystem: {
      type: (partition.filesystem ?? "unknown").toLowerCase(),
      label,
      totalBytes: sizeBytes,
      usedBytes,
      minimumSizeBytes,
    },
    mounted: Boolean(partition.mountpoint),
    encrypted: Boolean(partition.encrypted),
    dirty: Boolean(partition.filesystem_state && partition.filesystem_state !== "clean"),
    movable: partition.movable ?? label.toUpperCase() === "E",
    resizable: partition.resizable ?? ["C", "E"].includes(label.toUpperCase()),
  };
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

function isPartitionLabGeometryLayout(input: unknown): input is PartitionLabGeometryLayout {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PartitionLabGeometryLayout>;
  return (
    candidate.schema === "partition-lab.layout.v1" &&
    Boolean(candidate.disk && typeof candidate.disk === "object") &&
    typeof candidate.disk?.label === "string" &&
    typeof candidate.disk.sector_size === "number" &&
    typeof candidate.disk.alignment_sectors === "number" &&
    typeof candidate.disk.size_bytes === "number" &&
    Array.isArray(candidate.disk.partitions)
  );
}

function isPartitionLabValidationRequest(input: unknown): input is PartitionLabValidationRequest {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PartitionLabValidationRequest>;
  return (
    candidate.schema === "tenra-partition.lab-validation-request.v1" &&
    typeof candidate.exportedAt === "string" &&
    (candidate.source?.schema === "partition-lab.disk-layout.v1" ||
      candidate.source?.schema === "partition-lab.layout.v1") &&
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

function isPartitionLabValidationResult(input: unknown): input is PartitionLabValidationResult {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PartitionLabValidationResult>;
  return (
    candidate.schema === "tenra-partition.lab-validation-result.v1" &&
    typeof candidate.exportedAt === "string" &&
    Boolean(candidate.sourceRequest) &&
    Boolean(candidate.reviewedPlan) &&
    Boolean(candidate.simulation) &&
    Boolean(candidate.review)
  );
}

function isPartitionGuardrailDecision(input: unknown): input is PartitionGuardrailDecision {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PartitionGuardrailDecision>;
  return (
    candidate.schema === "tenra-guardrail.external-action-decision.v1" &&
    typeof candidate.decidedAt === "string" &&
    typeof candidate.requestTraceId === "string" &&
    (candidate.decision === "allow" || candidate.decision === "review" || candidate.decision === "deny") &&
    typeof candidate.reason === "string" &&
    candidate.sourceReturn?.app === "partition" &&
    candidate.sourceReturn.action === "apply-guardrail-decision"
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

function isPartitionLabCapabilities(input: unknown): input is PartitionLabCapabilities {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PartitionLabCapabilities>;
  return candidate.schema === "partition-lab.capabilities.v1" && Boolean(candidate.modes && typeof candidate.modes === "object");
}

function isPartitionLabCommandPlan(input: unknown): input is PartitionLabCommandPlan {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PartitionLabCommandPlan>;
  return candidate.schema === "partition-lab.command-plan.v1" && Boolean(candidate.modes && typeof candidate.modes === "object");
}

function isPartitionLabGeometryRun(input: unknown): input is PartitionLabGeometryRun {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PartitionLabGeometryRun>;
  return (
    candidate.schema === "partition-lab.geometry-run.v1" &&
    typeof candidate.run_id === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.source_image === "string" &&
    typeof candidate.run_dir === "string"
  );
}

function isPartitionLabVerifyResult(input: unknown): input is PartitionLabVerifyResult {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PartitionLabVerifyResult>;
  return (
    candidate.schema === "partition-lab.verify.v1" &&
    typeof candidate.verification_status === "string" &&
    Array.isArray(candidate.checks)
  );
}

function isPartitionLabBatchReport(input: unknown): input is PartitionLabBatchReport {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PartitionLabBatchReport>;
  return (
    candidate.schema === "partition-lab.batch-report.v1" &&
    typeof candidate.batch_id === "string" &&
    typeof candidate.run_dir === "string" &&
    Boolean(candidate.summary && typeof candidate.summary === "object") &&
    typeof candidate.summary?.total === "number" &&
    typeof candidate.summary.pass === "number" &&
    typeof candidate.summary.blocked === "number" &&
    typeof candidate.summary.fail === "number" &&
    Array.isArray(candidate.scenarios)
  );
}

function isPartitionLabVmPlan(input: unknown): input is PartitionLabVmPlan {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PartitionLabVmPlan>;
  return (
    candidate.schema === "partition-lab.vm-plan.v1" &&
    typeof candidate.plan_id === "string" &&
    typeof candidate.status === "string"
  );
}

function isPartitionLabMacGate(input: unknown): input is PartitionLabMacGate {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PartitionLabMacGate>;
  return (
    candidate.schema === "partition-lab.mac-gate.v1" &&
    typeof candidate.gate_id === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.run_dir === "string" &&
    Boolean(candidate.batch_report && typeof candidate.batch_report === "object")
  );
}

function isPartitionLabWindowsHandoff(input: unknown): input is PartitionLabWindowsHandoff {
  if (!input || typeof input !== "object") return false;
  const candidate = input as Partial<PartitionLabWindowsHandoff>;
  return (
    candidate.schema === "partition-lab.windows-handoff.v1" &&
    typeof candidate.handoff_id === "string" &&
    typeof candidate.status === "string" &&
    typeof candidate.run_dir === "string" &&
    Boolean(candidate.batch_report && typeof candidate.batch_report === "object")
  );
}
