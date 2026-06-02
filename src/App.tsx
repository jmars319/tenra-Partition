import "./App.css";
import { PartitionSidebar } from "./components/PartitionSidebar";
import { PartitionWorkspace } from "./components/PartitionWorkspace";
import { usePartitionWorkspace } from "./app/usePartitionWorkspace";

function App() {
  const model = usePartitionWorkspace();

  return (
    <main className="app-shell">
      <PartitionSidebar
        fileInputRef={model.fileInputRef}
        labRequestInputRef={model.labRequestInputRef}
        labResultInputRef={model.labResultInputRef}
        labArtifactInputRef={model.labArtifactInputRef}
        importError={model.importError}
        selectedScenarioId={model.selectedScenarioId}
        onImport={model.handleImport}
        onLabRequestImport={model.handleLabRequestImport}
        onLabResultImport={model.handleLabResultImport}
        onLabArtifactImport={model.handleLabArtifactImport}
        onResetScenario={model.actions.resetScenario}
        onScenarioSelect={model.actions.applyScenario}
        onExportPlan={model.actions.exportPlan}
      />
      <PartitionWorkspace model={model} />
    </main>
  );
}

export default App;
