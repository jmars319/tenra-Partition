import { ShieldCheck } from "lucide-react";
import { formatBytes, percentage } from "../domain/bytes";
import { getPartitionEnd, sortPartitions } from "../domain/layout";
import type { Disk, Partition, SafetyFinding } from "../domain/types";

export function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="section-header">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </header>
  );
}

export function DiskMap({
  disk,
  selectedLetters,
  muted = false,
}: {
  disk: Disk;
  selectedLetters: string[];
  muted?: boolean;
}) {
  const blocks = buildDiskBlocks(disk);

  return (
    <div className={`disk-map ${muted ? "disk-map-muted" : ""}`}>
      {blocks.map((block) => {
        const width = Math.max(percentage(block.sizeBytes, disk.sizeBytes), 2.2);
        const isSelected =
          block.partition?.letter && selectedLetters.includes(block.partition.letter);
        return (
          <div
            className={`disk-block disk-block-${block.kind} ${
              isSelected ? "disk-block-selected" : ""
            }`}
            key={block.id}
            style={{ width: `${width}%` }}
            title={`${block.label}: ${formatBytes(block.sizeBytes)}`}
          >
            <span>{block.label}</span>
            <small>{formatBytes(block.sizeBytes)}</small>
          </div>
        );
      })}
    </div>
  );
}

export function PartitionCard({ partition }: { partition: Partition }) {
  const used = partition.filesystem
    ? percentage(partition.filesystem.usedBytes, partition.filesystem.totalBytes)
    : 0;
  const flags = [
    partition.mounted ? "mounted" : undefined,
    partition.encrypted ? "encrypted" : undefined,
    partition.dirty ? "dirty" : undefined,
  ].filter(Boolean);

  return (
    <article className="partition-card">
      <header>
        <div>
          <h3>{partition.letter ? `${partition.letter}: ` : ""}{partition.name}</h3>
          <p>
            {partition.filesystem?.type.toUpperCase() ?? "Unknown FS"} ·{" "}
            {formatBytes(partition.sizeBytes)}
          </p>
        </div>
        <span>{formatBytes(getPartitionEnd(partition))}</span>
      </header>
      <div className="usage-meter" aria-label={`${used.toFixed(1)} percent used`}>
        <span style={{ width: `${used}%` }} />
      </div>
      <footer>
        <span>{partition.filesystem ? `${used.toFixed(1)}% used` : "No filesystem data"}</span>
        <span>{flags.length > 0 ? flags.join(", ") : "offline, clear"}</span>
      </footer>
    </article>
  );
}

export function SafetyReport({ findings }: { findings: SafetyFinding[] }) {
  if (findings.length === 0) {
    return (
      <div className="empty-findings">
        <ShieldCheck size={18} />
        <span>Ready for simulation. Execution remains locked.</span>
      </div>
    );
  }

  return (
    <ul className="finding-list">
      {findings.map((finding) => (
        <li className={`finding finding-${finding.severity}`} key={finding.id}>
          <span>{finding.severity}</span>
          <p>{finding.message}</p>
        </li>
      ))}
    </ul>
  );
}

function buildDiskBlocks(disk: Disk) {
  const blocks: Array<{
    id: string;
    kind: "partition" | "free";
    label: string;
    sizeBytes: number;
    partition?: Partition;
  }> = [];
  let cursor = 0;

  for (const partition of sortPartitions(disk.partitions)) {
    if (partition.startByte > cursor) {
      blocks.push({
        id: `free-${cursor}`,
        kind: "free",
        label: "Free",
        sizeBytes: partition.startByte - cursor,
      });
    }

    blocks.push({
      id: partition.id,
      kind: "partition",
      label: `${partition.letter ? `${partition.letter}: ` : ""}${partition.name}`,
      sizeBytes: partition.sizeBytes,
      partition,
    });
    cursor = getPartitionEnd(partition);
  }

  if (cursor < disk.sizeBytes) {
    blocks.push({
      id: `free-${cursor}`,
      kind: "free",
      label: "Free",
      sizeBytes: disk.sizeBytes - cursor,
    });
  }

  return blocks;
}
