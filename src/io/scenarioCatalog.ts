import appCeLayout from "../../fixtures/partition-lab-ce-layout.json";
import appMbrUnknownFs from "../../fixtures/refusal-mbr-unknown-fs.json";
import appNonAdjacent from "../../fixtures/refusal-non-adjacent.json";
import appUnsafeFlags from "../../fixtures/refusal-unsafe-flags.json";
import labDirtyFilesystem from "../../lab/fixtures/dirty-filesystem-placeholder.json";
import labEncryptedFilesystem from "../../lab/fixtures/encrypted-filesystem-placeholder.json";
import labGptLayout from "../../lab/fixtures/gpt-layout.json";
import labInsufficientSpace from "../../lab/fixtures/e-has-insufficient-free-space.json";
import labInterruptedOperation from "../../lab/fixtures/interrupted-operation-placeholder.json";
import labMbrLayout from "../../lab/fixtures/mbr-layout.json";
import labNonAdjacentFreeSpace from "../../lab/fixtures/non-adjacent-free-space.json";
import labNormalLayout from "../../lab/fixtures/normal-c-e-layout.json";

export type PartitionScenarioOutcome = "ready" | "refused";

export interface PartitionLabScenario {
  id: string;
  title: string;
  category: "baseline" | "refusal" | "table-compatibility" | "recovery-placeholder";
  summary: string;
  sourceArtifact: string;
  defaultExpansionGiB: number;
  expectedOutcome: PartitionScenarioOutcome;
  proves: string[];
  layout: unknown;
}

export const partitionLabScenarios: PartitionLabScenario[] = [
  {
    id: "app-mock-c-e-layout",
    title: "Mock C/E layout",
    category: "baseline",
    summary: "Current app-owned fixture with C followed by E and a recovery partition.",
    sourceArtifact: "fixtures/partition-lab-ce-layout.json",
    defaultExpansionGiB: 64,
    expectedOutcome: "ready",
    proves: [
      "Current product fixture still produces a complete read-only plan.",
      "The active UI can render before and after layouts from app-owned JSON.",
    ],
    layout: appCeLayout,
  },
  {
    id: "lab-normal-c-e-layout",
    title: "Lab normal C/E layout",
    category: "baseline",
    summary: "Preserved Partition-Lab raw-image fixture with immediately adjacent C and E.",
    sourceArtifact: "lab/fixtures/normal-c-e-layout.json",
    defaultExpansionGiB: 40,
    expectedOutcome: "ready",
    proves: [
      "The original lab happy path remains visible in the production app.",
      "Raw-image geometry fixtures can drive the same read-only planner.",
    ],
    layout: labNormalLayout,
  },
  {
    id: "app-non-adjacent-refusal",
    title: "App non-adjacent refusal",
    category: "refusal",
    summary: "App-owned refusal fixture where the source partition is not immediately after C.",
    sourceArtifact: "fixtures/refusal-non-adjacent.json",
    defaultExpansionGiB: 64,
    expectedOutcome: "refused",
    proves: [
      "The planner blocks layouts that cannot create adjacent free space for C.",
      "Safety findings stay understandable from the main UI.",
    ],
    layout: appNonAdjacent,
  },
  {
    id: "app-unsafe-flags-refusal",
    title: "Unsafe flags refusal",
    category: "refusal",
    summary: "Mounted, encrypted, and dirty filesystem flags are all visible as blockers.",
    sourceArtifact: "fixtures/refusal-unsafe-flags.json",
    defaultExpansionGiB: 64,
    expectedOutcome: "refused",
    proves: [
      "BitLocker/encryption, mount state, and dirty filesystem markers prevent planning.",
      "The app preserves the lab safety model before any destructive work exists.",
    ],
    layout: appUnsafeFlags,
  },
  {
    id: "app-mbr-unknown-fs-refusal",
    title: "MBR and unknown filesystem",
    category: "table-compatibility",
    summary: "Legacy table and unknown filesystem metadata are refused until support is explicit.",
    sourceArtifact: "fixtures/refusal-mbr-unknown-fs.json",
    defaultExpansionGiB: 64,
    expectedOutcome: "refused",
    proves: [
      "MBR is not silently treated as safe.",
      "Unknown filesystem data blocks plan generation instead of guessing.",
    ],
    layout: appMbrUnknownFs,
  },
  {
    id: "lab-insufficient-space",
    title: "Insufficient E: free space",
    category: "refusal",
    summary: "Original lab fixture where E cannot safely donate the requested space.",
    sourceArtifact: "lab/fixtures/e-has-insufficient-free-space.json",
    defaultExpansionGiB: 40,
    expectedOutcome: "refused",
    proves: [
      "Shrink capacity is enforced from filesystem metadata.",
      "The old lab capacity test is available without opening scripts.",
    ],
    layout: labInsufficientSpace,
  },
  {
    id: "lab-dirty-filesystem",
    title: "Dirty filesystem placeholder",
    category: "refusal",
    summary: "Original placeholder for a repair-required NTFS filesystem.",
    sourceArtifact: "lab/fixtures/dirty-filesystem-placeholder.json",
    defaultExpansionGiB: 40,
    expectedOutcome: "refused",
    proves: [
      "Filesystem repair requirements are first-class safety blockers.",
      "Future Windows validation can keep using the same scenario name.",
    ],
    layout: labDirtyFilesystem,
  },
  {
    id: "lab-encrypted-filesystem",
    title: "Encrypted filesystem placeholder",
    category: "refusal",
    summary: "Original BitLocker-like placeholder that must stay blocked by default.",
    sourceArtifact: "lab/fixtures/encrypted-filesystem-placeholder.json",
    defaultExpansionGiB: 40,
    expectedOutcome: "refused",
    proves: [
      "Encrypted volumes are refused unless a later policy explicitly supports them.",
      "Lab placeholders can be selected and reviewed from the app.",
    ],
    layout: labEncryptedFilesystem,
  },
  {
    id: "lab-non-adjacent-free-space",
    title: "Free space after E:",
    category: "baseline",
    summary: "Original fixture showing that free space after E does not help C directly.",
    sourceArtifact: "lab/fixtures/non-adjacent-free-space.json",
    defaultExpansionGiB: 40,
    expectedOutcome: "ready",
    proves: [
      "The app models why E still must move right before C can expand.",
      "Existing free space after E does not bypass the planned operation sequence.",
    ],
    layout: labNonAdjacentFreeSpace,
  },
  {
    id: "lab-gpt-layout",
    title: "Generic GPT layout",
    category: "baseline",
    summary: "Original GPT geometry fixture for exercising table parsing.",
    sourceArtifact: "lab/fixtures/gpt-layout.json",
    defaultExpansionGiB: 16,
    expectedOutcome: "ready",
    proves: [
      "Generic GPT layouts load through the same geometry adapter.",
      "The app keeps a compact table-parsing sanity check visible.",
    ],
    layout: labGptLayout,
  },
  {
    id: "lab-mbr-layout",
    title: "Generic MBR layout",
    category: "table-compatibility",
    summary: "Original MBR geometry fixture retained as an explicit unsupported case.",
    sourceArtifact: "lab/fixtures/mbr-layout.json",
    defaultExpansionGiB: 40,
    expectedOutcome: "refused",
    proves: [
      "MBR support remains a deliberate future decision.",
      "Compatibility gaps are visible without changing active support policy.",
    ],
    layout: labMbrLayout,
  },
  {
    id: "lab-interrupted-operation",
    title: "Interrupted operation placeholder",
    category: "recovery-placeholder",
    summary: "Original recovery-oriented placeholder for future interrupted-write handling.",
    sourceArtifact: "lab/fixtures/interrupted-operation-placeholder.json",
    defaultExpansionGiB: 40,
    expectedOutcome: "refused",
    proves: [
      "Recovery scenarios are tracked even before destructive execution exists.",
      "Future interrupted-operation tests have a named UI entry point.",
    ],
    layout: labInterruptedOperation,
  },
];

export const defaultPartitionLabScenario = partitionLabScenarios[0];

export function getPartitionLabScenario(id: string): PartitionLabScenario {
  return (
    partitionLabScenarios.find((scenario) => scenario.id === id) ??
    defaultPartitionLabScenario
  );
}
