import { describe, expect, it } from "vitest";
import ceFixture from "../fixtures/partition-lab-ce-layout.json";
import { gibToBytes } from "../src/domain/bytes";
import { loadDiskFromPartitionLabExport } from "../src/io/partitionLab";
import {
  getSourceShrinkCapacity,
  planGiveSpaceToTarget,
} from "../src/planner/giveSpacePlanner";

describe("planGiveSpaceToTarget", () => {
  it("generates the required E-to-C workflow and marks movement as required", () => {
    const disk = loadDiskFromPartitionLabExport(ceFixture);
    const plan = planGiveSpaceToTarget({
      disk,
      sourceLetter: "E",
      targetLetter: "C",
      expansionBytes: gibToBytes(64),
    });

    expect(plan.status).toBe("ready");
    expect(plan.requiresMovement).toBe(true);
    expect(plan.explanation).toContain("must be moved right");
    expect(plan.operations.map((operation) => operation.type)).toEqual([
      "shrink-filesystem",
      "shrink-partition",
      "move-partition",
      "create-adjacent-free-space",
      "expand-partition",
      "expand-filesystem",
    ]);
  });

  it("reports source shrink capacity from filesystem minimum size", () => {
    const disk = loadDiskFromPartitionLabExport(ceFixture);
    const plan = planGiveSpaceToTarget({
      disk,
      sourceLetter: "E",
      targetLetter: "C",
      expansionBytes: gibToBytes(64),
    });

    expect(getSourceShrinkCapacity(plan)).toBeGreaterThan(gibToBytes(200));
  });
});
