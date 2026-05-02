import { formatBytes } from "../domain/bytes";
import {
  findPartitionByLetter,
  getAvailableShrinkBytes,
} from "../domain/layout";
import { Disk, Operation, OperationPlan } from "../domain/types";
import { buildSafetyReport, validationFromReport } from "../safety/validator";

export interface GiveSpacePlannerInput {
  disk: Disk;
  sourceLetter: string;
  targetLetter: string;
  expansionBytes: number;
}

export function planGiveSpaceToTarget(input: GiveSpacePlannerInput): OperationPlan {
  const source = findPartitionByLetter(input.disk, input.sourceLetter);
  const target = findPartitionByLetter(input.disk, input.targetLetter);
  const safetyReport = buildSafetyReport({
    disk: input.disk,
    source,
    target,
    requestedExpansionBytes: input.expansionBytes,
  });
  const validation = validationFromReport(safetyReport);
  const id = `plan-${input.targetLetter.toLowerCase()}-${input.sourceLetter.toLowerCase()}-${input.expansionBytes}`;
  const explanation =
    source && target
      ? `${source.letter}: cannot simply be shrunk and ${target.letter}: extended. Shrinking ${source.letter}: creates free space to the right of ${source.letter}:, so ${source.letter}: must be moved right before ${target.letter}: can expand.`
      : "The source and target partitions must exist before the E-to-C workflow can be planned.";

  const operations =
    validation.ok && source && target
      ? buildOperations({
          source,
          target,
          expansionBytes: input.expansionBytes,
        })
      : [];

  return {
    id,
    workflow: "give-space-to-target",
    createdAt: new Date().toISOString(),
    status: validation.ok ? "ready" : "refused",
    disk: input.disk,
    targetPartitionId: target?.id ?? "",
    sourcePartitionId: source?.id ?? "",
    requestedExpansionBytes: input.expansionBytes,
    requiresMovement: true,
    explanation,
    operations,
    safetyReport,
    validation,
  };
}

function buildOperations({
  source,
  target,
  expansionBytes,
}: {
  source: NonNullable<ReturnType<typeof findPartitionByLetter>>;
  target: NonNullable<ReturnType<typeof findPartitionByLetter>>;
  expansionBytes: number;
}): Operation[] {
  const sourceSize = source.sizeBytes;
  const targetSize = target.sizeBytes;
  const sourceFilesystemSize = source.filesystem?.totalBytes ?? source.sizeBytes;
  const targetFilesystemSize = target.filesystem?.totalBytes ?? target.sizeBytes;
  const resultingSourceSize = sourceSize - expansionBytes;
  const resultingTargetSize = targetSize + expansionBytes;
  const readableAmount = formatBytes(expansionBytes);

  return [
    {
      id: "shrink-source-filesystem",
      type: "shrink-filesystem",
      title: `Shrink ${source.letter}: filesystem`,
      description: `Reduce the NTFS filesystem on ${source.letter}: by ${readableAmount} while preserving used data constraints.`,
      partitionId: source.id,
      amountBytes: expansionBytes,
      resultingFilesystemBytes: sourceFilesystemSize - expansionBytes,
    },
    {
      id: "shrink-source-partition",
      type: "shrink-partition",
      title: `Shrink ${source.letter}: partition`,
      description: `Reduce the partition boundary on ${source.letter}: to match the smaller filesystem.`,
      partitionId: source.id,
      amountBytes: expansionBytes,
      resultingSizeBytes: resultingSourceSize,
    },
    {
      id: "move-source-right",
      type: "move-partition",
      title: `Move ${source.letter}: to the right`,
      description: `Move ${source.letter}: right by ${readableAmount} so the free space becomes adjacent to ${target.letter}:.`,
      partitionId: source.id,
      amountBytes: expansionBytes,
      resultingStartByte: source.startByte + expansionBytes,
    },
    {
      id: "create-target-adjacent-free-space",
      type: "create-adjacent-free-space",
      title: `Create free space after ${target.letter}:`,
      description: `The move leaves ${readableAmount} of unallocated space immediately after ${target.letter}:.`,
      amountBytes: expansionBytes,
    },
    {
      id: "expand-target-partition",
      type: "expand-partition",
      title: `Expand ${target.letter}: partition`,
      description: `Extend ${target.letter}: into the adjacent free space.`,
      partitionId: target.id,
      amountBytes: expansionBytes,
      resultingSizeBytes: resultingTargetSize,
    },
    {
      id: "expand-target-filesystem",
      type: "expand-filesystem",
      title: `Expand ${target.letter}: filesystem`,
      description: `Grow the NTFS filesystem on ${target.letter}: to fill the expanded partition.`,
      partitionId: target.id,
      amountBytes: expansionBytes,
      resultingFilesystemBytes: targetFilesystemSize + expansionBytes,
    },
  ];
}

export function getSourceShrinkCapacity(plan: OperationPlan): number {
  const source = plan.disk.partitions.find(
    (partition) => partition.id === plan.sourcePartitionId,
  );
  return source ? getAvailableShrinkBytes(source) : 0;
}
