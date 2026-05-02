import { describe, expect, it } from "vitest";
import ceFixture from "../fixtures/partition-lab-ce-layout.json";
import { gibToBytes } from "../src/domain/bytes";
import { findPartitionByLetter, getPartitionEnd } from "../src/domain/layout";
import { loadDiskFromPartitionLabExport } from "../src/io/partitionLab";
import { planGiveSpaceToTarget } from "../src/planner/giveSpacePlanner";
import { simulateOperationPlan } from "../src/simulation/simulator";

describe("simulateOperationPlan", () => {
  it("applies the queue in memory and validates the final layout", () => {
    const disk = loadDiskFromPartitionLabExport(ceFixture);
    const expansionBytes = gibToBytes(64);
    const beforeC = findPartitionByLetter(disk, "C");
    const beforeE = findPartitionByLetter(disk, "E");
    const plan = planGiveSpaceToTarget({
      disk,
      sourceLetter: "E",
      targetLetter: "C",
      expansionBytes,
    });

    const simulation = simulateOperationPlan(plan);
    const afterC = findPartitionByLetter(simulation.disk, "C");
    const afterE = findPartitionByLetter(simulation.disk, "E");

    expect(simulation.ok).toBe(true);
    expect(afterC?.sizeBytes).toBe((beforeC?.sizeBytes ?? 0) + expansionBytes);
    expect(afterE?.sizeBytes).toBe((beforeE?.sizeBytes ?? 0) - expansionBytes);
    expect(afterE?.startByte).toBe((beforeE?.startByte ?? 0) + expansionBytes);
    expect(afterC && afterE ? getPartitionEnd(afterC) : 0).toBe(afterE?.startByte);
    expect(afterC?.filesystem?.totalBytes).toBe(afterC?.sizeBytes);
  });
});
