export const GIB = 1024 ** 3;
export const MIB = 1024 ** 2;

export function gibToBytes(value: number): number {
  return Math.round(value * GIB);
}

export function bytesToGiB(value: number): number {
  return value / GIB;
}

export function formatBytes(value: number): string {
  if (value >= GIB) {
    return `${bytesToGiB(value).toFixed(value % GIB === 0 ? 0 : 1)} GiB`;
  }

  if (value >= MIB) {
    return `${(value / MIB).toFixed(value % MIB === 0 ? 0 : 1)} MiB`;
  }

  return `${value} B`;
}

export function percentage(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, (part / total) * 100));
}

export function isAligned(value: number, alignmentBytes: number): boolean {
  return alignmentBytes > 0 && value % alignmentBytes === 0;
}
