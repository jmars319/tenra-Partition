import { describe, expect, it } from "vitest";
import { loadPartitionLabArtifact } from "../src/io/partitionLab";

describe("Partition Lab artifact import", () => {
  it("imports capability, command-plan, geometry-run, verification, batch, and VM artifacts", () => {
    const capabilities = loadPartitionLabArtifact({
      schema: "partition-lab.capabilities.v1",
      host: { platform: "Darwin", machine: "arm64" },
      modes: { raw_geometry: { available: true, blockers: [] } },
    });
    const commandPlan = loadPartitionLabArtifact({
      schema: "partition-lab.command-plan.v1",
      scenario: "normal-c-e-layout",
      modes: { raw_geometry: { status: "ready", blockers: [], steps: [] } },
    });
    const geometryRun = loadPartitionLabArtifact({
      schema: "partition-lab.geometry-run.v1",
      run_id: "geometry-test",
      status: "pass",
      source_image: "lab/test-images/source.raw.img",
      work_image: "lab/runs/work.raw.img",
      run_dir: "lab/runs/geometry-test",
    });
    const verification = loadPartitionLabArtifact({
      schema: "partition-lab.verify.v1",
      verification_status: "pass",
      checks: [],
    });
    const batch = loadPartitionLabArtifact({
      schema: "partition-lab.batch-report.v1",
      batch_id: "batch-test",
      run_dir: "lab/runs/batch-test",
      summary: { total: 2, pass: 1, blocked: 1, fail: 0 },
      scenarios: [
        { name: "normal-c-e-layout", status: "pass" },
        { name: "missing-manifest", status: "blocked", blockers: [{ id: "manifest-missing" }] },
      ],
    });
    const vmPlan = loadPartitionLabArtifact({
      schema: "partition-lab.vm-plan.v1",
      plan_id: "vm-test",
      status: "ready",
      blockers: [],
      qemu_command: ["qemu-system-x86_64"],
    });

    expect(capabilities.schema).toBe("partition-lab.capabilities.v1");
    expect(commandPlan.schema).toBe("partition-lab.command-plan.v1");
    expect(geometryRun.schema).toBe("partition-lab.geometry-run.v1");
    expect(verification.schema).toBe("partition-lab.verify.v1");
    expect(batch.schema).toBe("partition-lab.batch-report.v1");
    expect(vmPlan.schema).toBe("partition-lab.vm-plan.v1");
  });

  it("refuses unknown lab artifact schemas", () => {
    expect(() => loadPartitionLabArtifact({ schema: "partition-lab.unknown.v1" })).toThrow(
      /Partition Lab artifact/,
    );
  });
});
