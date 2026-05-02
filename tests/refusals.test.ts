import { describe, expect, it } from "vitest";
import nonAdjacentFixture from "../fixtures/refusal-non-adjacent.json";
import unsafeFlagsFixture from "../fixtures/refusal-unsafe-flags.json";
import mbrUnknownFsFixture from "../fixtures/refusal-mbr-unknown-fs.json";
import ceFixture from "../fixtures/partition-lab-ce-layout.json";
import { cloneDisk } from "../src/domain/layout";
import { gibToBytes } from "../src/domain/bytes";
import { loadDiskFromPartitionLabExport } from "../src/io/partitionLab";
import { planGiveSpaceToTarget } from "../src/planner/giveSpacePlanner";

describe("planner refusal cases", () => {
  it("refuses non-adjacent target and source partitions", () => {
    const disk = loadDiskFromPartitionLabExport(nonAdjacentFixture);
    const plan = planGiveSpaceToTarget({
      disk,
      sourceLetter: "E",
      targetLetter: "C",
      expansionBytes: gibToBytes(64),
    });

    expect(plan.status).toBe("refused");
    expect(plan.safetyReport.findings.map((finding) => finding.category)).toContain("adjacency");
  });

  it("refuses mounted, encrypted, and dirty placeholder flags", () => {
    const disk = loadDiskFromPartitionLabExport(unsafeFlagsFixture);
    const plan = planGiveSpaceToTarget({
      disk,
      sourceLetter: "E",
      targetLetter: "C",
      expansionBytes: gibToBytes(64),
    });

    expect(plan.status).toBe("refused");
    expect(plan.safetyReport.findings.map((finding) => finding.category)).toEqual(
      expect.arrayContaining(["mount", "encryption", "dirty-filesystem"]),
    );
  });

  it("refuses MBR and unknown filesystem layouts", () => {
    const disk = loadDiskFromPartitionLabExport(mbrUnknownFsFixture);
    const plan = planGiveSpaceToTarget({
      disk,
      sourceLetter: "E",
      targetLetter: "C",
      expansionBytes: gibToBytes(64),
    });

    expect(plan.status).toBe("refused");
    expect(plan.safetyReport.findings.map((finding) => finding.category)).toEqual(
      expect.arrayContaining(["partition-table", "filesystem"]),
    );
  });

  it("refuses insufficient shrinkable free space", () => {
    const disk = cloneDisk(loadDiskFromPartitionLabExport(ceFixture));
    const plan = planGiveSpaceToTarget({
      disk,
      sourceLetter: "E",
      targetLetter: "C",
      expansionBytes: gibToBytes(300),
    });

    expect(plan.status).toBe("refused");
    expect(plan.safetyReport.findings.map((finding) => finding.category)).toContain("capacity");
  });
});
