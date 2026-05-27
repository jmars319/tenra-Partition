import { describe, expect, it } from "vitest";
import { gibToBytes } from "../src/domain/bytes";
import { loadDiskFromPartitionLabExport } from "../src/io/partitionLab";
import { partitionLabScenarios } from "../src/io/scenarioCatalog";
import { planGiveSpaceToTarget } from "../src/planner/giveSpacePlanner";

describe("Partition scenario catalog", () => {
  it("keeps built-in scenarios unique and loadable", () => {
    const ids = new Set(partitionLabScenarios.map((scenario) => scenario.id));

    expect(ids.size).toBe(partitionLabScenarios.length);
    expect(partitionLabScenarios.length).toBeGreaterThanOrEqual(8);

    for (const scenario of partitionLabScenarios) {
      const disk = loadDiskFromPartitionLabExport(scenario.layout);
      expect(disk.partitions.length).toBeGreaterThan(0);
      expect(scenario.proves.length).toBeGreaterThan(0);
      expect(scenario.sourceArtifact).toMatch(/^(fixtures|lab\/fixtures)\//);
    }
  });

  it("matches each scenario expectation against the read-only planner", () => {
    for (const scenario of partitionLabScenarios) {
      const plan = planGiveSpaceToTarget({
        disk: loadDiskFromPartitionLabExport(scenario.layout),
        sourceLetter: "E",
        targetLetter: "C",
        expansionBytes: gibToBytes(scenario.defaultExpansionGiB),
      });

      expect(plan.status, scenario.id).toBe(scenario.expectedOutcome);
    }
  });
});
