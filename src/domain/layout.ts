import { Disk, Partition } from "./types";

export function cloneDisk(disk: Disk): Disk {
  return structuredClone(disk);
}

export function sortPartitions(partitions: Partition[]): Partition[] {
  return [...partitions].sort((a, b) => a.startByte - b.startByte);
}

export function getPartitionEnd(partition: Partition): number {
  return partition.startByte + partition.sizeBytes;
}

export function findPartitionByLetter(disk: Disk, letter: string): Partition | undefined {
  return disk.partitions.find(
    (partition) => partition.letter?.toUpperCase() === letter.toUpperCase(),
  );
}

export function findPartitionIndex(disk: Disk, partitionId: string): number {
  return disk.partitions.findIndex((partition) => partition.id === partitionId);
}

export function areAdjacent(left: Partition, right: Partition): boolean {
  return getPartitionEnd(left) === right.startByte;
}

export function getAvailableShrinkBytes(partition: Partition): number {
  if (!partition.filesystem) return 0;
  return Math.max(0, partition.sizeBytes - partition.filesystem.minimumSizeBytes);
}

export function replacePartition(disk: Disk, partition: Partition): Disk {
  return {
    ...disk,
    partitions: disk.partitions.map((current) =>
      current.id === partition.id ? partition : current,
    ),
  };
}

export function hasOverlaps(disk: Disk): boolean {
  const sorted = sortPartitions(disk.partitions);
  return sorted.some((partition, index) => {
    const next = sorted[index + 1];
    return next ? getPartitionEnd(partition) > next.startByte : false;
  });
}
