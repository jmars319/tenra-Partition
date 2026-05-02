export type DiskScheme = "GPT" | "MBR";

export type FilesystemType =
  | "ntfs"
  | "fat32"
  | "exfat"
  | "apfs"
  | "ext4"
  | "unknown";

export interface Filesystem {
  type: FilesystemType | string;
  label?: string;
  totalBytes: number;
  usedBytes: number;
  minimumSizeBytes: number;
}

export interface Partition {
  id: string;
  number: number;
  name: string;
  letter?: string;
  startByte: number;
  sizeBytes: number;
  filesystem?: Filesystem;
  mounted: boolean;
  encrypted: boolean;
  dirty: boolean;
  movable: boolean;
  resizable: boolean;
}

export interface Disk {
  id: string;
  name: string;
  sizeBytes: number;
  sectorSizeBytes: number;
  alignmentBytes: number;
  scheme: DiskScheme;
  partitions: Partition[];
}

export type OperationType =
  | "shrink-filesystem"
  | "shrink-partition"
  | "move-partition"
  | "create-adjacent-free-space"
  | "expand-partition"
  | "expand-filesystem";

export interface Operation {
  id: string;
  type: OperationType;
  title: string;
  description: string;
  partitionId?: string;
  amountBytes: number;
  resultingStartByte?: number;
  resultingSizeBytes?: number;
  resultingFilesystemBytes?: number;
}

export type PlanStatus = "ready" | "refused";

export interface OperationPlan {
  id: string;
  workflow: "give-space-to-target";
  createdAt: string;
  status: PlanStatus;
  disk: Disk;
  targetPartitionId: string;
  sourcePartitionId: string;
  requestedExpansionBytes: number;
  requiresMovement: boolean;
  explanation: string;
  operations: Operation[];
  safetyReport: SafetyReport;
  validation: ValidationResult;
}

export type SafetySeverity = "info" | "warning" | "blocking";

export type SafetyCategory =
  | "filesystem"
  | "mount"
  | "encryption"
  | "dirty-filesystem"
  | "capacity"
  | "adjacency"
  | "partition-table"
  | "alignment"
  | "unsupported-operation";

export interface SafetyFinding {
  id: string;
  severity: SafetySeverity;
  category: SafetyCategory;
  message: string;
  partitionId?: string;
}

export interface SafetyReport {
  level: "clear" | "review" | "blocked";
  findings: SafetyFinding[];
}

export interface ValidationResult {
  ok: boolean;
  summary: string;
  errors: string[];
  warnings: string[];
}
