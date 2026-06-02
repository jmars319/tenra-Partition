import type { PartitionLabMetadata } from "../io/partitionLab";
import type { PartitionLabScenario } from "../io/scenarioCatalog";
import { formatScenarioCategory } from "../app/formatting";
import { SectionHeader } from "./DiskViews";

export function ScenarioCatalogPanel({
  scenarios,
  selectedScenarioId,
  onSelect,
}: {
  scenarios: PartitionLabScenario[];
  selectedScenarioId: string;
  onSelect: (scenario: PartitionLabScenario) => void;
}) {
  const groupedScenarios = scenarios.reduce<Record<PartitionLabScenario["category"], PartitionLabScenario[]>>(
    (groups, scenario) => ({
      ...groups,
      [scenario.category]: [...groups[scenario.category], scenario],
    }),
    {
      baseline: [],
      refusal: [],
      "recovery-review": [],
      "table-compatibility": [],
    },
  );

  return (
    <section className="sidebar-section scenario-catalog">
      <h2>Scenario catalog</h2>
      {Object.entries(groupedScenarios).map(([category, items]) =>
        items.length ? (
          <div className="scenario-group" key={category}>
            <span>{formatScenarioCategory(category)}</span>
            {items.map((scenario) => {
              const selected = scenario.id === selectedScenarioId;
              return (
                <button
                  aria-pressed={selected}
                  className={`scenario-button${selected ? " scenario-button-active" : ""}`}
                  key={scenario.id}
                  type="button"
                  onClick={() => onSelect(scenario)}
                >
                  <strong>{scenario.title}</strong>
                  <small>{scenario.expectedOutcome} · {scenario.sourceLabel ?? scenario.sourceArtifact}</small>
                </button>
              );
            })}
          </div>
        ) : null,
      )}
    </section>
  );
}

export function ScenarioFocusPanel({
  scenario,
  metadata,
  planStatus,
}: {
  scenario: PartitionLabScenario | null;
  metadata: PartitionLabMetadata;
  planStatus: string;
}) {
  if (!scenario) {
    return (
      <section className="surface scenario-focus">
        <SectionHeader
          title="Imported layout"
          subtitle="Manual JSON import outside the built-in scenario catalog"
        />
        <div className="scenario-status-row">
          <span>{metadata.schema}</span>
          <strong>{metadata.source}</strong>
        </div>
      </section>
    );
  }

  const matchesExpectation = scenario.expectedOutcome === planStatus;

  return (
    <section className="surface scenario-focus">
      <SectionHeader title="Scenario focus" subtitle={scenario.sourceLabel ?? scenario.sourceArtifact} />
      <div className="scenario-status-row">
        <span>{formatScenarioCategory(scenario.category)}</span>
        <strong>{scenario.title}</strong>
      </div>
      <p>{scenario.summary}</p>
      <div className={matchesExpectation ? "scenario-match" : "scenario-mismatch"}>
        Expected {scenario.expectedOutcome}; current plan is {planStatus}.
      </div>
      <ul>
        {scenario.proves.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
