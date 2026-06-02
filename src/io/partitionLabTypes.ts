import type { Disk, OperationPlan, SafetyReport, ValidationResult } from "../domain/types";

export interface PartitionLabDiskLayout {
  schema: "partition-lab.disk-layout.v1";
  capturedAt: string;
  source: string;
  disk: Disk;
}

export interface PartitionLabGeometryLayout {
  schema: "partition-lab.layout.v1";
  scenario?: string;
  mode?: string;
  description?: string;
  image?: {
    path?: string;
    image_id?: string;
  };
  disk: {
    id?: string;
    path?: string;
    label: string;
    sector_size: number;
    alignment_sectors: number;
    size_bytes: number;
    partitions: PartitionLabGeometryPartition[];
  };
}

export interface PartitionLabGeometryPartition {
  number: number;
  label?: string;
  name?: string;
  type?: string;
  start_sector: number;
  end_sector: number;
  filesystem?: string;
  filesystem_state?: string;
  mountpoint?: string | null;
  encrypted?: boolean;
  used_bytes?: number;
  free_bytes?: number;
  minimum_size_bytes?: number;
  movable?: boolean;
  resizable?: boolean;
}

export interface PartitionLabMetadata {
  schema: PartitionLabDiskLayout["schema"] | PartitionLabGeometryLayout["schema"];
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

export interface PartitionLabValidationResult {
  schema: "tenra-partition.lab-validation-result.v1";
  exportedAt: string;
  sourceRequest: PartitionLabValidationRequest;
  reviewedPlan: OperationPlan;
  simulation: {
    ok: boolean;
    validation: ValidationResult;
    disk: Disk;
  };
  review: {
    status: "reviewed" | "blocked";
    requestedPlanMatchesReviewedPlan: boolean;
    safetyPosture: SafetyReport["level"];
    differences: string[];
    execution: {
      enabled: false;
      reason: string;
    };
  };
}

export interface PartitionGuardrailDecision {
  schema: "tenra-guardrail.external-action-decision.v1";
  decidedAt: string;
  requestTraceId: string;
  decision: "allow" | "review" | "deny";
  reason: string;
  sourceReturn?: {
    app?: string;
    traceId?: string;
    expectedSchema?: string;
    action?: string;
  };
}

export interface PartitionLabCapabilities {
  schema: "partition-lab.capabilities.v1";
  host: {
    platform?: string;
    machine?: string;
  };
  modes: Record<string, {
    available: boolean;
    blockers?: string[];
  }>;
  blockers?: Array<{ id: string; message: string }>;
  warnings?: Array<{ id: string; message: string }>;
}

export interface PartitionLabCommandPlan {
  schema: "partition-lab.command-plan.v1";
  scenario?: string;
  modes: Record<string, {
    status: string;
    dry_run_only?: boolean;
    blockers?: string[];
    steps?: Array<{
      step: number;
      id: string;
      title: string;
      writes: boolean;
    }>;
  }>;
}

export interface PartitionLabGeometryRun {
  schema: "partition-lab.geometry-run.v1";
  run_id: string;
  status: string;
  failure_class?: string | null;
  source_image: string;
  work_image?: string | null;
  run_dir: string;
  preflight?: { status: string };
  postflight?: { status: string };
  checks?: Array<{ name: string; status: string }>;
  preserved_artifacts?: Array<{ kind: string; path: string }>;
}

export interface PartitionLabVerifyResult {
  schema: "partition-lab.verify.v1";
  scenario?: string;
  verification_status: string;
  checks: Array<{ name: string; status: string }>;
}

export interface PartitionLabBatchReport {
  schema: "partition-lab.batch-report.v1";
  batch_id: string;
  run_dir: string;
  summary: {
    total: number;
    pass: number;
    blocked: number;
    fail: number;
  };
  scenarios: Array<{
    name: string;
    status: string;
    blockers?: Array<{ id: string; message?: string }>;
  }>;
}

export interface PartitionLabVmPlan {
  schema: "partition-lab.vm-plan.v1";
  plan_id: string;
  status: string;
  blockers?: Array<{ id: string; message?: string }>;
  iso?: { path?: string | null };
  work_image?: { path?: string | null };
  qemu_command?: string[];
  steps?: Array<{ id: string; title: string }>;
}

export interface PartitionLabMacGate {
  schema: "partition-lab.mac-gate.v1";
  gate_id: string;
  status: string;
  run_dir: string;
  batch_report: {
    summary: {
      pass: number;
      blocked: number;
      fail: number;
    };
  };
  vm_plan?: {
    status?: string;
    blockers?: Array<{ id: string; message?: string }>;
  } | null;
  blockers?: Array<{ id: string; message?: string }>;
}

export interface PartitionLabWindowsHandoff {
  schema: "partition-lab.windows-handoff.v1";
  handoff_id: string;
  status: string;
  run_dir: string;
  batch_report: {
    summary: {
      pass: number;
      blocked: number;
      fail: number;
    };
  };
  windows_checklist?: Array<{ id: string; status: string; description?: string }>;
  next_windows_commands?: Array<{ id: string; description?: string; command?: string[] }>;
  excluded_large_artifacts?: Array<{ path: string }>;
}

export type PartitionLabArtifact =
  | PartitionLabCapabilities
  | PartitionLabCommandPlan
  | PartitionLabGeometryRun
  | PartitionLabVerifyResult
  | PartitionLabBatchReport
  | PartitionLabVmPlan
  | PartitionLabMacGate
  | PartitionLabWindowsHandoff;
