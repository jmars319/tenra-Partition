import { Download, FileJson, FileText, HardDrive, Lock, ShieldCheck, Upload } from "lucide-react";
import type { ChangeEvent, RefObject } from "react";
import type { ExportFormat } from "../app/constants";
import { partitionLabScenarios, type PartitionLabScenario } from "../io/scenarioCatalog";
import { ScenarioCatalogPanel } from "./ScenarioPanels";

export function PartitionSidebar({
  fileInputRef,
  labRequestInputRef,
  labResultInputRef,
  labArtifactInputRef,
  importError,
  selectedScenarioId,
  onImport,
  onLabRequestImport,
  onLabResultImport,
  onLabArtifactImport,
  onResetScenario,
  onScenarioSelect,
  onExportPlan,
}: {
  fileInputRef: RefObject<HTMLInputElement | null>;
  labRequestInputRef: RefObject<HTMLInputElement | null>;
  labResultInputRef: RefObject<HTMLInputElement | null>;
  labArtifactInputRef: RefObject<HTMLInputElement | null>;
  importError: string;
  selectedScenarioId: string;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onLabRequestImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onLabResultImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onLabArtifactImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onResetScenario: () => void;
  onScenarioSelect: (scenario: PartitionLabScenario) => void;
  onExportPlan: (format: ExportFormat) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true">
          TP
        </div>
        <div>
          <h1>Partition by Tenra</h1>
          <p>Read-only planner</p>
        </div>
      </div>

      <nav className="workflow-list" aria-label="Workflow">
        <button className="workflow-item workflow-item-active" type="button">
          <HardDrive size={18} />
          <span>Give space from E to C</span>
        </button>
        <button className="workflow-item" type="button" disabled>
          <Lock size={18} />
          <span>Execution locked</span>
        </button>
        <button className="workflow-item" type="button">
          <ShieldCheck size={18} />
          <span>Lab harness visible</span>
        </button>
      </nav>

      <section className="sidebar-section">
        <h2>Disk input</h2>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={onImport}
        />
        <input
          ref={labRequestInputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={onLabRequestImport}
        />
        <input
          ref={labResultInputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={onLabResultImport}
        />
        <input
          ref={labArtifactInputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={onLabArtifactImport}
        />
        <div className="button-grid">
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />
            Import JSON
          </button>
          <button type="button" onClick={() => labRequestInputRef.current?.click()}>
            <FileJson size={16} />
            Lab request
          </button>
          <button type="button" onClick={() => labResultInputRef.current?.click()}>
            <FileJson size={16} />
            Lab result
          </button>
          <button type="button" onClick={() => labArtifactInputRef.current?.click()}>
            <FileJson size={16} />
            Lab artifact
          </button>
          <button type="button" onClick={onResetScenario}>
            <FileJson size={16} />
            Local C/E layout
          </button>
        </div>
        {importError ? <p className="import-error">{importError}</p> : null}
      </section>

      <ScenarioCatalogPanel
        scenarios={partitionLabScenarios}
        selectedScenarioId={selectedScenarioId}
        onSelect={onScenarioSelect}
      />

      <section className="sidebar-section">
        <h2>Export</h2>
        <div className="button-grid">
          <button type="button" onClick={() => onExportPlan("plan-json")}>
            <Download size={16} />
            Plan JSON
          </button>
          <button type="button" onClick={() => onExportPlan("report-json")}>
            <ShieldCheck size={16} />
            Safety JSON
          </button>
          <button type="button" onClick={() => onExportPlan("summary")}>
            <FileText size={16} />
            Summary
          </button>
        </div>
      </section>

      <section className="sidebar-section boundary-note">
        <h2>Boundary</h2>
        <p>The planner and lab harness now live in one app. Execution stays locked until disposable-image validation proves the workflow.</p>
      </section>
    </aside>
  );
}
