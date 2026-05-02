import { isAligned } from "../domain/bytes";
import {
  Disk,
  Partition,
  SafetyFinding,
  SafetyReport,
  ValidationResult,
} from "../domain/types";
import {
  areAdjacent,
  getAvailableShrinkBytes,
  getPartitionEnd,
  sortPartitions,
} from "../domain/layout";

const SUPPORTED_FILESYSTEMS = new Set(["ntfs"]);

export function buildSafetyReport({
  disk,
  source,
  target,
  requestedExpansionBytes,
}: {
  disk: Disk;
  source?: Partition;
  target?: Partition;
  requestedExpansionBytes: number;
}): SafetyReport {
  const findings: SafetyFinding[] = [];

  if (disk.scheme !== "GPT") {
    findings.push({
      id: "unsupported-partition-table",
      severity: "blocking",
      category: "partition-table",
      message: `Only GPT layouts are supported in the initial planner. This disk is ${disk.scheme}.`,
    });
  }

  for (const partition of disk.partitions) {
    if (!isAligned(partition.startByte, disk.alignmentBytes)) {
      findings.push({
        id: `unaligned-start-${partition.id}`,
        severity: "blocking",
        category: "alignment",
        partitionId: partition.id,
        message: `${partition.name} starts outside the ${disk.alignmentBytes} byte alignment boundary.`,
      });
    }

    if (!isAligned(partition.sizeBytes, disk.alignmentBytes)) {
      findings.push({
        id: `unaligned-size-${partition.id}`,
        severity: "blocking",
        category: "alignment",
        partitionId: partition.id,
        message: `${partition.name} size is outside the ${disk.alignmentBytes} byte alignment boundary.`,
      });
    }

    if (!partition.filesystem) {
      findings.push({
        id: `missing-filesystem-${partition.id}`,
        severity: "blocking",
        category: "filesystem",
        partitionId: partition.id,
        message: `${partition.name} has no filesystem information.`,
      });
      continue;
    }

    if (!SUPPORTED_FILESYSTEMS.has(partition.filesystem.type)) {
      findings.push({
        id: `unsupported-filesystem-${partition.id}`,
        severity: "blocking",
        category: "filesystem",
        partitionId: partition.id,
        message: `${partition.name} uses ${partition.filesystem.type}, which is not supported by the initial planner.`,
      });
    }

    if (partition.mounted) {
      findings.push({
        id: `mounted-${partition.id}`,
        severity: "blocking",
        category: "mount",
        partitionId: partition.id,
        message: `${partition.name} is mounted. Planning is read-only, but the operation is refused as unsafe for later execution.`,
      });
    }

    if (partition.encrypted) {
      findings.push({
        id: `encrypted-${partition.id}`,
        severity: "blocking",
        category: "encryption",
        partitionId: partition.id,
        message: `${partition.name} is marked encrypted or BitLocker-protected.`,
      });
    }

    if (partition.dirty) {
      findings.push({
        id: `dirty-${partition.id}`,
        severity: "blocking",
        category: "dirty-filesystem",
        partitionId: partition.id,
        message: `${partition.name} is marked dirty and needs filesystem repair before planning.`,
      });
    }
  }

  if (!source || !target) {
    findings.push({
      id: "missing-target-or-source",
      severity: "blocking",
      category: "unsupported-operation",
      message: "The requested source and target partitions could not be found.",
    });
  }

  if (source && target) {
    const sorted = sortPartitions(disk.partitions);
    const targetIndex = sorted.findIndex((partition) => partition.id === target.id);
    const sourceIndex = sorted.findIndex((partition) => partition.id === source.id);

    if (targetIndex === -1 || sourceIndex === -1 || sourceIndex !== targetIndex + 1) {
      findings.push({
        id: "source-not-immediately-after-target",
        severity: "blocking",
        category: "adjacency",
        message: `${source.name} must be immediately after ${target.name} to create adjacent expansion space.`,
      });
    } else if (!areAdjacent(target, source)) {
      findings.push({
        id: "target-source-gap",
        severity: "blocking",
        category: "adjacency",
        message: `${target.name} and ${source.name} are ordered correctly but not directly adjacent.`,
      });
    }

    if (!source.movable) {
      findings.push({
        id: "source-not-movable",
        severity: "blocking",
        category: "unsupported-operation",
        partitionId: source.id,
        message: `${source.name} must be movable because shrinking it creates free space after it, not after ${target.name}.`,
      });
    }

    if (!source.resizable || !target.resizable) {
      findings.push({
        id: "resize-not-supported",
        severity: "blocking",
        category: "unsupported-operation",
        message: "Both the source and target partitions must support resizing.",
      });
    }

    if (requestedExpansionBytes <= 0) {
      findings.push({
        id: "invalid-requested-size",
        severity: "blocking",
        category: "capacity",
        message: "The requested expansion size must be greater than zero.",
      });
    }

    if (requestedExpansionBytes > getAvailableShrinkBytes(source)) {
      findings.push({
        id: "insufficient-free-space",
        severity: "blocking",
        category: "capacity",
        partitionId: source.id,
        message: `${source.name} does not have enough shrinkable free space for the requested expansion.`,
      });
    }

    if (getPartitionEnd(source) > disk.sizeBytes) {
      findings.push({
        id: "partition-beyond-disk-end",
        severity: "blocking",
        category: "alignment",
        partitionId: source.id,
        message: `${source.name} extends beyond the end of the disk model.`,
      });
    }
  }

  const hasBlocking = findings.some((finding) => finding.severity === "blocking");
  const hasWarning = findings.some((finding) => finding.severity === "warning");

  return {
    level: hasBlocking ? "blocked" : hasWarning ? "review" : "clear",
    findings,
  };
}

export function validationFromReport(report: SafetyReport): ValidationResult {
  const errors = report.findings
    .filter((finding) => finding.severity === "blocking")
    .map((finding) => finding.message);
  const warnings = report.findings
    .filter((finding) => finding.severity === "warning")
    .map((finding) => finding.message);

  return {
    ok: errors.length === 0,
    summary:
      errors.length === 0
        ? "Safety checks passed for read-only simulation."
        : "Plan refused because blocking safety checks failed.",
    errors,
    warnings,
  };
}
