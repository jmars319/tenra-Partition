import { type ChangeEvent, useMemo, useRef, useState } from "react";
import { cloneDisk } from "../domain/layout";
import { type Disk } from "../domain/types";
import {
  createGuardrailReviewFromLabResult,
  createHumanReadableSummary,
  createLabValidationResult,
  loadDiskFromPartitionLabExport,
  loadLabValidationRequest,
  loadLabValidationResult,
  loadPartitionGuardrailDecision,
  loadPartitionLabArtifact,
  readPartitionLabMetadata,
  type PartitionGuardrailDecision,
  type PartitionLabArtifact,
  type PartitionLabMetadata,
  type PartitionLabValidationRequest,
  type PartitionLabValidationResult,
} from "../io/partitionLab";
import {
  defaultPartitionLabScenario,
  partitionLabScenarios,
  type PartitionLabScenario,
} from "../io/scenarioCatalog";
import { planGiveSpaceToTarget } from "../planner/giveSpacePlanner";
import { simulateOperationPlan } from "../simulation/simulator";
import {
  EXECUTION_DISABLED_REASON,
  type ExportFormat,
  labCommands,
} from "./constants";
import { downloadFile } from "./download";
import { gibToBytes } from "../domain/bytes";

const fixtureDisk = loadDiskFromPartitionLabExport(defaultPartitionLabScenario.layout);
const fixtureLabMetadata = readPartitionLabMetadata(defaultPartitionLabScenario.layout);

export function usePartitionWorkspace() {
  const [disk, setDisk] = useState<Disk>(() => cloneDisk(fixtureDisk));
  const [labMetadata, setLabMetadata] = useState<PartitionLabMetadata>(() => fixtureLabMetadata);
  const [selectedScenarioId, setSelectedScenarioId] = useState(defaultPartitionLabScenario.id);
  const [desiredGiB, setDesiredGiB] = useState(64);
  const [importError, setImportError] = useState("");
  const [copiedCommandId, setCopiedCommandId] = useState("");
  const [labValidationRequest, setLabValidationRequest] =
    useState<PartitionLabValidationRequest | null>(null);
  const [labValidationResult, setLabValidationResult] =
    useState<PartitionLabValidationResult | null>(null);
  const [guardrailDecisionJson, setGuardrailDecisionJson] = useState("");
  const [guardrailDecision, setGuardrailDecision] = useState<PartitionGuardrailDecision | null>(null);
  const [guardrailDecisionHistory, setGuardrailDecisionHistory] = useState<PartitionGuardrailDecision[]>([]);
  const [labArtifacts, setLabArtifacts] = useState<PartitionLabArtifact[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const labRequestInputRef = useRef<HTMLInputElement | null>(null);
  const labResultInputRef = useRef<HTMLInputElement | null>(null);
  const labArtifactInputRef = useRef<HTMLInputElement | null>(null);

  const selectedScenario =
    partitionLabScenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null;
  const plan = useMemo(
    () =>
      planGiveSpaceToTarget({
        disk,
        sourceLetter: "E",
        targetLetter: "C",
        expansionBytes: gibToBytes(desiredGiB),
      }),
    [desiredGiB, disk],
  );
  const simulation = useMemo(() => simulateOperationPlan(plan), [plan]);
  const afterDisk = simulation.ok ? simulation.disk : undefined;
  const blockingCount = plan.safetyReport.findings.filter(
    (finding) => finding.severity === "blocking",
  ).length;

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    try {
      const json = JSON.parse(await file.text());
      setDisk(loadDiskFromPartitionLabExport(json));
      setLabMetadata(readPartitionLabMetadata(json));
      setSelectedScenarioId("");
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unknown import error.");
    } finally {
      event.currentTarget.value = "";
    }
  }

  async function handleLabRequestImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    try {
      setLabValidationRequest(loadLabValidationRequest(JSON.parse(await file.text())));
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unknown lab request import error.");
      setLabValidationRequest(null);
    } finally {
      event.currentTarget.value = "";
    }
  }

  async function handleLabResultImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    try {
      setLabValidationResult(loadLabValidationResult(JSON.parse(await file.text())));
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unknown lab result import error.");
      setLabValidationResult(null);
    } finally {
      event.currentTarget.value = "";
    }
  }

  async function handleLabArtifactImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (!file) return;

    try {
      const artifact = loadPartitionLabArtifact(JSON.parse(await file.text()));
      setLabArtifacts((current) => [artifact, ...current].slice(0, 6));
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Unknown lab artifact import error.");
    } finally {
      event.currentTarget.value = "";
    }
  }

  function resetScenario() {
    applyScenario(defaultPartitionLabScenario);
  }

  function applyScenario(scenario: PartitionLabScenario) {
    setDisk(cloneDisk(loadDiskFromPartitionLabExport(scenario.layout)));
    setLabMetadata(readPartitionLabMetadata(scenario.layout));
    setDesiredGiB(scenario.defaultExpansionGiB);
    setSelectedScenarioId(scenario.id);
    setImportError("");
  }

  function exportPlan(format: ExportFormat) {
    const filenameBase = `${plan.id}-${format}`;
    if (format === "plan-json") {
      downloadFile(`${filenameBase}.json`, JSON.stringify(plan, null, 2), "application/json");
      return;
    }

    if (format === "report-json") {
      downloadFile(`${filenameBase}.json`, JSON.stringify(plan.safetyReport, null, 2), "application/json");
      return;
    }

    downloadFile(`${filenameBase}.txt`, createHumanReadableSummary(plan), "text/plain");
  }

  async function copyLabCommand(command: (typeof labCommands)[number]) {
    await navigator.clipboard.writeText(command.command);
    setCopiedCommandId(command.id);
    window.setTimeout(() => setCopiedCommandId(""), 1800);
  }

  function exportLabRequest() {
    downloadFile(
      `${plan.id}-lab-validation-request.json`,
      JSON.stringify(
        {
          schema: "tenra-partition.lab-validation-request.v1",
          exportedAt: new Date().toISOString(),
          source: labMetadata,
          requestedExpansionBytes: plan.requestedExpansionBytes,
          plan,
          simulation: {
            ok: simulation.ok,
            validation: simulation.validation,
          },
          execution: {
            enabled: false,
            reason: EXECUTION_DISABLED_REASON,
          },
        },
        null,
        2,
      ),
      "application/json",
    );
  }

  function exportLabResult() {
    if (!labValidationRequest) return;

    const result = createLabValidationResult({
      sourceRequest: labValidationRequest,
      reviewedPlan: plan,
      simulation,
      executionDisabledReason: EXECUTION_DISABLED_REASON,
    });

    downloadFile(`${plan.id}-lab-validation-result.json`, JSON.stringify(result, null, 2), "application/json");
  }

  function exportGuardrailReview() {
    const result =
      labValidationResult ??
      (labValidationRequest
        ? createLabValidationResult({
            sourceRequest: labValidationRequest,
            reviewedPlan: plan,
            simulation,
            executionDisabledReason: EXECUTION_DISABLED_REASON,
          })
        : null);

    if (!result) return;

    downloadFile(
      `${plan.id}-guardrail-review.json`,
      JSON.stringify(createGuardrailReviewFromLabResult({ result }), null, 2),
      "application/json",
    );
  }

  function importGuardrailDecision() {
    if (!guardrailDecisionJson.trim()) {
      setImportError("Paste Guardrail decision JSON before importing.");
      return;
    }

    try {
      const decision = loadPartitionGuardrailDecision(JSON.parse(guardrailDecisionJson));
      const expectedTraceId = labValidationResult
        ? `partition-lab-${labValidationResult.sourceRequest.plan.id}`
        : labValidationRequest
          ? `partition-lab-${labValidationRequest.plan.id}`
          : "";
      if (expectedTraceId && decision.requestTraceId !== expectedTraceId) {
        throw new Error("Guardrail decision does not match the current Partition lab review.");
      }
      setGuardrailDecision(decision);
      setGuardrailDecisionHistory((current) =>
        [decision, ...current.filter((item) => item.requestTraceId !== decision.requestTraceId)].slice(0, 5),
      );
      setGuardrailDecisionJson("");
      setImportError("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Guardrail decision import failed.");
    }
  }

  return {
    afterDisk,
    blockingCount,
    copiedCommandId,
    desiredGiB,
    disk,
    fileInputRef,
    guardrailDecision,
    guardrailDecisionHistory,
    guardrailDecisionJson,
    handleImport,
    handleLabArtifactImport,
    handleLabRequestImport,
    handleLabResultImport,
    importError,
    importGuardrailDecision,
    labArtifactInputRef,
    labArtifacts,
    labCommands,
    labMetadata,
    labRequestInputRef,
    labResultInputRef,
    labValidationRequest,
    labValidationResult,
    plan,
    selectedScenario,
    selectedScenarioId,
    setDesiredGiB,
    setGuardrailDecisionJson,
    simulation,
    actions: {
      applyScenario,
      copyLabCommand,
      exportGuardrailReview,
      exportLabRequest,
      exportLabResult,
      exportPlan,
      resetScenario,
    },
  };
}

export type PartitionWorkspaceModel = ReturnType<typeof usePartitionWorkspace>;
