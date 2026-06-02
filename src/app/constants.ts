export const EXECUTION_DISABLED_REASON =
  "Execution is not available. Future destructive workflows must first prove a restorable backup on an external drive and pass disposable-image lab validation.";

export type ExportFormat = "plan-json" | "report-json" | "summary";

export type LabCommand = {
  id: string;
  label: string;
  command: string;
};

export const labCommands: LabCommand[] = [
  {
    id: "smoke",
    label: "POSIX smoke",
    command: "npm run lab:smoke:posix",
  },
  {
    id: "plan",
    label: "Lab review plan",
    command:
      "cd lab && scripts/plan_operation.py --layout fixtures/normal-c-e-layout.json --increase-c 40G",
  },
  {
    id: "ui",
    label: "Lab UI",
    command: "cd lab && scripts/start_ui.sh --open",
  },
];
