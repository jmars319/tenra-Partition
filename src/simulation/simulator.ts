import {
  cloneDisk,
  findPartitionIndex,
  getPartitionEnd,
  hasOverlaps,
} from "../domain/layout";
import { Disk, Operation, OperationPlan, Partition, ValidationResult } from "../domain/types";

export interface SimulationResult {
  ok: boolean;
  disk: Disk;
  validation: ValidationResult;
}

export function simulateOperationPlan(plan: OperationPlan): SimulationResult {
  const disk = cloneDisk(plan.disk);

  if (plan.status !== "ready") {
    return {
      ok: false,
      disk,
      validation: {
        ok: false,
        summary: "Simulation skipped because the plan is refused.",
        errors: plan.validation.errors,
        warnings: plan.validation.warnings,
      },
    };
  }

  for (const operation of plan.operations) {
    applyOperation(disk, operation);
  }

  const validation = validateSimulatedFinalLayout(plan, disk);

  return {
    ok: validation.ok,
    disk,
    validation,
  };
}

function applyOperation(disk: Disk, operation: Operation): void {
  if (operation.type === "create-adjacent-free-space") return;
  if (!operation.partitionId) {
    throw new Error(`Operation ${operation.id} is missing a partition id.`);
  }

  const index = findPartitionIndex(disk, operation.partitionId);
  if (index < 0) {
    throw new Error(`Partition ${operation.partitionId} was not found.`);
  }

  const partition = disk.partitions[index];
  disk.partitions[index] = applyPartitionOperation(partition, operation);
}

function applyPartitionOperation(partition: Partition, operation: Operation): Partition {
  switch (operation.type) {
    case "shrink-filesystem":
    case "expand-filesystem":
      if (!partition.filesystem || operation.resultingFilesystemBytes === undefined) {
        throw new Error(`${operation.type} requires filesystem metadata.`);
      }
      return {
        ...partition,
        filesystem: {
          ...partition.filesystem,
          totalBytes: operation.resultingFilesystemBytes,
        },
      };
    case "shrink-partition":
    case "expand-partition":
      if (operation.resultingSizeBytes === undefined) {
        throw new Error(`${operation.type} requires a resulting partition size.`);
      }
      return {
        ...partition,
        sizeBytes: operation.resultingSizeBytes,
      };
    case "move-partition":
      if (operation.resultingStartByte === undefined) {
        throw new Error("move-partition requires a resulting start byte.");
      }
      return {
        ...partition,
        startByte: operation.resultingStartByte,
      };
    case "create-adjacent-free-space":
      return partition;
    default:
      return assertNever(operation.type);
  }
}

function validateSimulatedFinalLayout(plan: OperationPlan, disk: Disk): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const beforeTarget = plan.disk.partitions.find(
    (partition) => partition.id === plan.targetPartitionId,
  );
  const beforeSource = plan.disk.partitions.find(
    (partition) => partition.id === plan.sourcePartitionId,
  );
  const afterTarget = disk.partitions.find(
    (partition) => partition.id === plan.targetPartitionId,
  );
  const afterSource = disk.partitions.find(
    (partition) => partition.id === plan.sourcePartitionId,
  );

  if (!beforeTarget || !beforeSource || !afterTarget || !afterSource) {
    errors.push("The target or source partition is missing from the simulation.");
  } else {
    if (afterTarget.sizeBytes !== beforeTarget.sizeBytes + plan.requestedExpansionBytes) {
      errors.push("The target partition did not grow by the requested amount.");
    }

    if (afterSource.sizeBytes !== beforeSource.sizeBytes - plan.requestedExpansionBytes) {
      errors.push("The source partition did not shrink by the requested amount.");
    }

    if (afterSource.startByte !== beforeSource.startByte + plan.requestedExpansionBytes) {
      errors.push("The source partition was not moved right by the requested amount.");
    }

    if (getPartitionEnd(afterTarget) !== afterSource.startByte) {
      errors.push("The target partition does not end immediately before the moved source.");
    }

    if (afterTarget.filesystem?.totalBytes !== afterTarget.sizeBytes) {
      errors.push("The target filesystem does not fill the expanded partition.");
    }
  }

  if (hasOverlaps(disk)) {
    errors.push("The simulated layout contains overlapping partitions.");
  }

  return {
    ok: errors.length === 0,
    summary:
      errors.length === 0
        ? "Simulation matches the requested C expansion and leaves E adjacent to C."
        : "Simulation finished with layout validation errors.",
    errors,
    warnings,
  };
}

function assertNever(value: never): never {
  throw new Error(`Unhandled operation type: ${value}`);
}
