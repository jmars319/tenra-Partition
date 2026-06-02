import { AlertTriangle, CheckCircle2, Lock, ShieldAlert } from "lucide-react";
import { formatBytes } from "../domain/bytes";
import { sortPartitions } from "../domain/layout";
import type { PartitionWorkspaceModel } from "../app/usePartitionWorkspace";
import { EXECUTION_DISABLED_REASON } from "../app/constants";
import { DiskMap, PartitionCard, SafetyReport, SectionHeader } from "./DiskViews";
import { LabStatusPanel } from "./LabStatusPanel";
import { ScenarioFocusPanel } from "./ScenarioPanels";

export function PartitionWorkspace({
  model,
}: {
  model: PartitionWorkspaceModel;
}) {
  const {
    afterDisk,
    blockingCount,
    desiredGiB,
    disk,
    labCommands,
    labMetadata,
    labValidationRequest,
    labValidationResult,
    plan,
    selectedScenario,
    setDesiredGiB,
    simulation,
  } = model;

  return (
    <section className="workspace" aria-label="Partition planning workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">{disk.name}</p>
          <h2>{formatBytes(disk.sizeBytes)} {disk.scheme} disk</h2>
        </div>
        <div className={`plan-status plan-status-${plan.status}`}>
          {plan.status === "ready" ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
          <span>{plan.status === "ready" ? "Plan ready" : "Plan refused"}</span>
        </div>
      </header>

      <section className="plan-grid">
        <section className="primary-column">
          <section className="surface">
            <SectionHeader
              title="Before"
              subtitle="Imported layout from the read-only scanner abstraction"
            />
            <DiskMap disk={disk} selectedLetters={["C", "E"]} />
          </section>

          <section className="surface">
            <SectionHeader
              title="After simulation"
              subtitle={
                afterDisk
                  ? "In-memory result after applying the operation queue"
                  : "Simulation is unavailable until blocking findings are resolved"
              }
            />
            <DiskMap disk={afterDisk ?? disk} selectedLetters={["C", "E"]} muted={!afterDisk} />
            {simulation.ok ? (
              <p className="validation-note">{simulation.validation.summary}</p>
            ) : (
              <p className="validation-note validation-note-blocked">
                {simulation.validation.summary}
              </p>
            )}
          </section>

          <section className="partition-list">
            {sortPartitions(disk.partitions).map((partition) => (
              <PartitionCard key={partition.id} partition={partition} />
            ))}
          </section>
        </section>

        <aside className="inspector">
          <ScenarioFocusPanel
            scenario={selectedScenario}
            metadata={labMetadata}
            planStatus={plan.status}
          />

          <section className="surface">
            <SectionHeader title="Workflow" subtitle="Give space from E to C" />
            <label className="input-label" htmlFor="desired-size">
              Desired C expansion
            </label>
            <div className="size-control">
              <input
                id="desired-size"
                min={1}
                max={256}
                step={1}
                type="number"
                value={desiredGiB}
                onChange={(event) => setDesiredGiB(Number(event.currentTarget.value))}
              />
              <span>GiB</span>
            </div>
            <div className="concept-rule">
              <AlertTriangle size={18} />
              <p>{plan.explanation}</p>
            </div>
          </section>

          <section className="surface">
            <SectionHeader
              title="Safety report"
              subtitle={
                blockingCount > 0
                  ? `${blockingCount} blocking finding${blockingCount === 1 ? "" : "s"}`
                  : "No blocking findings for this local plan"
              }
            />
            <SafetyReport findings={plan.safetyReport.findings} />
          </section>

          <LabStatusPanel
            metadata={labMetadata}
            labValidationRequest={labValidationRequest}
            labValidationResult={labValidationResult}
            planStatus={plan.status}
            simulationOk={simulation.ok}
            commands={labCommands}
            copiedCommandId={model.copiedCommandId}
            onCopyCommand={model.actions.copyLabCommand}
            onExportLabRequest={model.actions.exportLabRequest}
            onExportLabResult={model.actions.exportLabResult}
            onExportGuardrailReview={model.actions.exportGuardrailReview}
            guardrailDecision={model.guardrailDecision}
            guardrailDecisionHistory={model.guardrailDecisionHistory}
            labArtifacts={model.labArtifacts}
            guardrailDecisionJson={model.guardrailDecisionJson}
            onGuardrailDecisionJsonChange={model.setGuardrailDecisionJson}
            onImportGuardrailDecision={model.importGuardrailDecision}
          />

          <button className="execute-button" type="button" disabled>
            <Lock size={18} />
            Execute disabled
          </button>
          <p className="execute-reason">{EXECUTION_DISABLED_REASON}</p>

          <section className="surface">
            <SectionHeader
              title="Operation queue"
              subtitle={`${plan.operations.length} planned read-only steps`}
            />
            <ol className="operation-list">
              {plan.operations.map((operation, index) => (
                <li key={operation.id}>
                  <span>{index + 1}</span>
                  <div>
                    <h3>{operation.title}</h3>
                    <p>{operation.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </section>
    </section>
  );
}
