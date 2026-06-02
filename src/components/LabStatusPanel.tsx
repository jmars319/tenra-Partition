import { Clipboard, Download, ShieldAlert, ShieldCheck } from "lucide-react";
import { formatBytes } from "../domain/bytes";
import type {
  PartitionGuardrailDecision,
  PartitionLabArtifact,
  PartitionLabMetadata,
  PartitionLabValidationRequest,
  PartitionLabValidationResult,
} from "../io/partitionLab";
import type { LabCommand } from "../app/constants";
import { formatTimestamp } from "../app/formatting";
import { SectionHeader } from "./DiskViews";

export function LabStatusPanel({
  metadata,
  labValidationRequest,
  labValidationResult,
  planStatus,
  simulationOk,
  commands,
  copiedCommandId,
  guardrailDecision,
  guardrailDecisionHistory,
  labArtifacts,
  guardrailDecisionJson,
  onCopyCommand,
  onExportLabRequest,
  onExportLabResult,
  onExportGuardrailReview,
  onGuardrailDecisionJsonChange,
  onImportGuardrailDecision,
}: {
  metadata: PartitionLabMetadata;
  labValidationRequest: PartitionLabValidationRequest | null;
  labValidationResult: PartitionLabValidationResult | null;
  guardrailDecision: PartitionGuardrailDecision | null;
  guardrailDecisionHistory: PartitionGuardrailDecision[];
  labArtifacts: PartitionLabArtifact[];
  guardrailDecisionJson: string;
  planStatus: string;
  simulationOk: boolean;
  commands: LabCommand[];
  copiedCommandId: string;
  onCopyCommand: (command: LabCommand) => void;
  onExportLabRequest: () => void;
  onExportLabResult: () => void;
  onExportGuardrailReview: () => void;
  onGuardrailDecisionJsonChange: (value: string) => void;
  onImportGuardrailDecision: () => void;
}) {
  const labDifferences = labValidationRequest
    ? [
        labValidationRequest.requestedExpansionBytes === labValidationRequest.plan.requestedExpansionBytes
          ? ""
          : "Requested expansion does not match the imported plan.",
        labValidationRequest.plan.operations.length === 0
          ? "Imported request has no operations."
          : "",
        labValidationRequest.simulation.ok === simulationOk
          ? ""
          : "Current simulation pass/fail differs from the imported request.",
      ].filter(Boolean)
    : [];
  const labResultBlocked = labValidationResult?.review.status === "blocked";
  const blockedLabResults = labValidationResult?.review.status === "blocked" && guardrailDecision?.decision !== "allow"
    ? [labValidationResult]
    : [];
  const guardrailResolution =
    guardrailDecision?.decision === "allow"
      ? "Guardrail allowed operator resolution. Execution remains locked until lab policy changes."
      : guardrailDecision?.decision === "deny"
        ? "Guardrail denied this operation. Keep the lab result blocked."
        : guardrailDecision?.decision === "review"
          ? "Guardrail requested another human review pass before this lab result can be resolved."
          : "";
  const stages = [
    {
      label: "Layout imported",
      detail: `${metadata.source} · ${formatTimestamp(metadata.capturedAt)}`,
      status: "ready",
    },
    {
      label: "Planner compared C and E",
      detail:
        planStatus === "ready"
          ? "The current local layout has a complete read-only operation queue."
          : "The current layout is blocked before execution can be considered.",
      status: planStatus === "ready" ? "ready" : "blocked",
    },
    {
      label: "Simulation replay",
      detail:
        simulationOk
          ? "Partition can render the modeled after-state without touching a disk."
          : "Simulation waits for blocking safety findings to clear.",
      status: simulationOk ? "ready" : "blocked",
    },
    {
      label: "Lab execution gate",
      detail:
        "Disposable VHDX/raw-image mutation remains locked until Partition Lab validates the full backend path.",
      status: "locked",
    },
  ];

  return (
    <section className="surface lab-panel">
      <SectionHeader
        title="Partition Lab"
        subtitle="Visible validation bridge for the destructive-test harness"
      />
      <div className="lab-summary">
        <div>
          <span>Mode</span>
          <strong>Local lab layout / imported Lab JSON</strong>
        </div>
        <div>
          <span>Execution</span>
          <strong>Locked</strong>
        </div>
      </div>
      <LabRequestSummary
        labDifferences={labDifferences}
        labValidationRequest={labValidationRequest}
      />
      <LabResultSummary
        guardrailDecision={guardrailDecision}
        guardrailResolution={guardrailResolution}
        labResultBlocked={labResultBlocked}
        labValidationResult={labValidationResult}
      />
      {blockedLabResults.length ? <BlockedLabResultQueue results={blockedLabResults} /> : null}
      {guardrailDecisionHistory.length ? (
        <DecisionHistory decisions={guardrailDecisionHistory} />
      ) : null}
      {labArtifacts.length ? <LabArtifactList artifacts={labArtifacts} /> : null}
      <ol className="lab-stage-list">
        {stages.map((stage, index) => (
          <li className={`lab-stage lab-stage-${stage.status}`} key={stage.label}>
            <span>{index + 1}</span>
            <div>
              <h3>{stage.label}</h3>
              <p>{stage.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="lab-actions">
        <button type="button" onClick={onExportLabRequest}>
          <Download size={16} />
          Lab request
        </button>
        <button type="button" disabled={!labValidationRequest} onClick={onExportLabResult}>
          <Download size={16} />
          Lab result
        </button>
        <button
          className={labResultBlocked ? "primary-next-action" : undefined}
          type="button"
          disabled={!labValidationRequest && !labValidationResult}
          onClick={onExportGuardrailReview}
        >
          <ShieldAlert size={16} />
          Guardrail
        </button>
        {commands.map((command) => (
          <button key={command.id} type="button" onClick={() => onCopyCommand(command)}>
            <Clipboard size={16} />
            {copiedCommandId === command.id ? "Copied" : command.label}
          </button>
        ))}
      </div>
      <label className="guardrail-decision-import">
        <span>Guardrail decision return</span>
        <textarea
          placeholder='{"schema":"tenra-guardrail.external-action-decision.v1","sourceReturn":{"app":"partition","action":"apply-guardrail-decision"},...}'
          value={guardrailDecisionJson}
          onChange={(event) => onGuardrailDecisionJsonChange(event.currentTarget.value)}
        />
      </label>
      <div className="lab-actions">
        <button type="button" onClick={onImportGuardrailDecision}>
          <ShieldCheck size={16} />
          Import decision
        </button>
      </div>
    </section>
  );
}

function LabRequestSummary({
  labDifferences,
  labValidationRequest,
}: {
  labDifferences: string[];
  labValidationRequest: PartitionLabValidationRequest | null;
}) {
  if (!labValidationRequest) return null;

  return (
    <div className="lab-request-summary">
      <span>Imported request</span>
      <strong>{formatBytes(labValidationRequest.requestedExpansionBytes)} requested</strong>
      <p>
        {labValidationRequest.source.schema} · {labValidationRequest.plan.operations.length} operation(s) · safety{" "}
        {labValidationRequest.plan.safetyReport.level}
      </p>
      <p>{labValidationRequest.plan.validation.summary}</p>
      <p>{labValidationRequest.simulation.validation.summary}</p>
      <p>{labValidationRequest.execution.reason}</p>
      <div className="lab-summary">
        <div>
          <span>Requested plan</span>
          <strong>{labValidationRequest.plan.status}</strong>
        </div>
        <div>
          <span>Simulation</span>
          <strong>{labValidationRequest.simulation.ok ? "passed" : "blocked"}</strong>
        </div>
        <div>
          <span>Safety</span>
          <strong>{labValidationRequest.plan.safetyReport.level}</strong>
        </div>
      </div>
      {labDifferences.length ? (
        <ul>
          {labDifferences.map((difference) => (
            <li key={difference}>{difference}</li>
          ))}
        </ul>
      ) : (
        <p>Requested plan, simulated result, and safety posture are aligned for this review pass.</p>
      )}
    </div>
  );
}

function LabResultSummary({
  guardrailDecision,
  guardrailResolution,
  labResultBlocked,
  labValidationResult,
}: {
  guardrailDecision: PartitionGuardrailDecision | null;
  guardrailResolution: string;
  labResultBlocked: boolean;
  labValidationResult: PartitionLabValidationResult | null;
}) {
  if (!labValidationResult) return null;

  return (
    <div className="lab-request-summary">
      <span>Imported result</span>
      <strong>{labValidationResult.review.status}</strong>
      <p>
        {labValidationResult.sourceRequest.plan.id} · safety {labValidationResult.review.safetyPosture} · simulation{" "}
        {labValidationResult.simulation.ok ? "passed" : "blocked"}
      </p>
      {labValidationResult.review.differences.length ? (
        <ul>
          {labValidationResult.review.differences.map((difference) => (
            <li key={difference}>{difference}</li>
          ))}
        </ul>
      ) : (
        <p>No differences were reported by the lab result.</p>
      )}
      {labResultBlocked ? (
        <div className="blocked-next-action">
          <span>Primary next action</span>
          <strong>Export Guardrail review before any operator escalation.</strong>
          <p>{labValidationResult.review.execution.reason}</p>
        </div>
      ) : null}
      {guardrailDecision ? (
        <div className={`blocked-next-action decision-${guardrailDecision.decision}`}>
          <span>Guardrail decision</span>
          <strong>{guardrailDecision.decision}</strong>
          <p>{guardrailDecision.reason}</p>
          <p>{guardrailResolution}</p>
        </div>
      ) : null}
    </div>
  );
}

function BlockedLabResultQueue({ results }: { results: PartitionLabValidationResult[] }) {
  return (
    <div className="lab-request-summary blocked-result-queue">
      <span>Blocked lab result queue</span>
      {results.map((result) => (
        <div key={result.sourceRequest.plan.id}>
          <strong>{result.sourceRequest.plan.id}</strong>
          <p>{result.review.execution.reason}</p>
        </div>
      ))}
    </div>
  );
}

function DecisionHistory({ decisions }: { decisions: PartitionGuardrailDecision[] }) {
  return (
    <div className="lab-request-summary">
      <span>Decision import history</span>
      {decisions.map((decision) => (
        <div key={`${decision.requestTraceId}-${decision.decidedAt}`}>
          <strong>{decision.decision}</strong>
          <p>{decision.requestTraceId} · {new Date(decision.decidedAt).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

function LabArtifactList({ artifacts }: { artifacts: PartitionLabArtifact[] }) {
  return (
    <div className="lab-request-summary">
      <span>Imported lab artifacts</span>
      <div className="lab-artifact-list">
        {artifacts.map((artifact, index) => (
          <LabArtifactCard artifact={artifact} key={`${artifact.schema}-${index}`} />
        ))}
      </div>
    </div>
  );
}

function LabArtifactCard({ artifact }: { artifact: PartitionLabArtifact }) {
  if (artifact.schema === "partition-lab.capabilities.v1") {
    return <CapabilitiesArtifact artifact={artifact} />;
  }
  if (artifact.schema === "partition-lab.command-plan.v1") {
    return <CommandPlanArtifact artifact={artifact} />;
  }
  if (artifact.schema === "partition-lab.geometry-run.v1") {
    return (
      <article className="lab-artifact-card">
        <strong>Geometry run · {artifact.status}</strong>
        <p>{artifact.run_id}</p>
        <p>{artifact.failure_class ? `Failure: ${artifact.failure_class}` : "No failure class"}</p>
        <p>{artifact.work_image ?? "No work image"}</p>
      </article>
    );
  }
  if (artifact.schema === "partition-lab.batch-report.v1") {
    return <BatchReportArtifact artifact={artifact} />;
  }
  if (artifact.schema === "partition-lab.vm-plan.v1") {
    return <VmPlanArtifact artifact={artifact} />;
  }
  if (artifact.schema === "partition-lab.mac-gate.v1") {
    return <MacGateArtifact artifact={artifact} />;
  }
  if (artifact.schema === "partition-lab.windows-handoff.v1") {
    return <WindowsHandoffArtifact artifact={artifact} />;
  }

  return (
    <article className="lab-artifact-card">
      <strong>Verification · {artifact.verification_status}</strong>
      <p>{artifact.scenario ?? "scenario"} · {artifact.checks.length} check(s)</p>
    </article>
  );
}

function CapabilitiesArtifact({ artifact }: { artifact: Extract<PartitionLabArtifact, { schema: "partition-lab.capabilities.v1" }> }) {
  return (
    <article className="lab-artifact-card">
      <strong>Capabilities · {artifact.host.platform ?? "host"}</strong>
      <div className="lab-artifact-grid">
        {Object.entries(artifact.modes).map(([name, mode]) => (
          <span className={mode.available ? "artifact-pass" : "artifact-blocked"} key={name}>
            {name}: {mode.available ? "available" : "blocked"}
          </span>
        ))}
      </div>
    </article>
  );
}

function CommandPlanArtifact({ artifact }: { artifact: Extract<PartitionLabArtifact, { schema: "partition-lab.command-plan.v1" }> }) {
  return (
    <article className="lab-artifact-card">
      <strong>Command plan · {artifact.scenario ?? "scenario"}</strong>
      <div className="lab-artifact-grid">
        {Object.entries(artifact.modes).map(([name, mode]) => (
          <span className={mode.status === "ready" ? "artifact-pass" : "artifact-blocked"} key={name}>
            {name}: {mode.status}
            {mode.blockers?.length ? ` (${mode.blockers.length})` : ""}
          </span>
        ))}
      </div>
    </article>
  );
}

function BatchReportArtifact({ artifact }: { artifact: Extract<PartitionLabArtifact, { schema: "partition-lab.batch-report.v1" }> }) {
  return (
    <article className="lab-artifact-card">
      <strong>Batch report · {artifact.summary.pass} pass / {artifact.summary.blocked} blocked / {artifact.summary.fail} fail</strong>
      <p>{artifact.batch_id}</p>
      <div className="lab-artifact-grid">
        {artifact.scenarios.slice(0, 6).map((scenario) => (
          <span className={scenario.status === "pass" ? "artifact-pass" : "artifact-blocked"} key={scenario.name}>
            {scenario.name}: {scenario.status}
            {scenario.blockers?.length ? ` (${scenario.blockers.length})` : ""}
          </span>
        ))}
      </div>
      <p>{artifact.run_dir}</p>
    </article>
  );
}

function VmPlanArtifact({ artifact }: { artifact: Extract<PartitionLabArtifact, { schema: "partition-lab.vm-plan.v1" }> }) {
  return (
    <article className="lab-artifact-card">
      <strong>VM plan · {artifact.status}</strong>
      <p>{artifact.plan_id}</p>
      <p>{artifact.iso?.path ?? "No ISO selected"}</p>
      <p>{artifact.work_image?.path ?? "No cloned work image"}</p>
      <div className="lab-artifact-grid">
        {(artifact.blockers ?? []).map((item) => (
          <span className="artifact-blocked" key={item.id}>{item.id}</span>
        ))}
        {artifact.qemu_command?.length ? <span className="artifact-pass">qemu command ready</span> : null}
      </div>
    </article>
  );
}

function MacGateArtifact({ artifact }: { artifact: Extract<PartitionLabArtifact, { schema: "partition-lab.mac-gate.v1" }> }) {
  const summary = artifact.batch_report.summary;
  const blockers = artifact.blockers ?? artifact.vm_plan?.blockers ?? [];
  return (
    <article className="lab-artifact-card">
      <strong>Mac gate · {artifact.status}</strong>
      <p>{artifact.gate_id}</p>
      <p>{summary.pass} pass / {summary.blocked} blocked / {summary.fail} fail</p>
      <p>{artifact.run_dir}</p>
      <div className="lab-artifact-grid">
        {blockers.map((item) => (
          <span className="artifact-blocked" key={item.id}>{item.id}</span>
        ))}
        {!blockers.length ? <span className="artifact-pass">ready for Windows handoff</span> : null}
      </div>
    </article>
  );
}

function WindowsHandoffArtifact({ artifact }: { artifact: Extract<PartitionLabArtifact, { schema: "partition-lab.windows-handoff.v1" }> }) {
  const summary = artifact.batch_report.summary;
  const commands = artifact.next_windows_commands?.slice(0, 4) ?? [];
  return (
    <article className="lab-artifact-card">
      <strong>Windows handoff · {artifact.status}</strong>
      <p>{artifact.handoff_id}</p>
      <p>{summary.pass} pass / {summary.blocked} blocked / {summary.fail} fail</p>
      <p>{artifact.run_dir}</p>
      <div className="lab-artifact-grid">
        {commands.map((item) => (
          <span className="artifact-pass" key={item.id}>{item.id}</span>
        ))}
        {artifact.excluded_large_artifacts?.length ? (
          <span className="artifact-blocked">{artifact.excluded_large_artifacts.length} image artifact(s) excluded</span>
        ) : null}
      </div>
    </article>
  );
}
