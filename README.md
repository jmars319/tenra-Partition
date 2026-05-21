# tenra Partition

tenra Partition is a read-only planning, simulation, and lab-validation app. It is designed to help operators reason about workflows and safety boundaries without letting the planning surface mutate live systems.

Future execution work must be backup-first and paired with an external drive. Partition should not gain any destructive operation path unless the workflow first proves where the backup will be written and verifies that the target data can be restored without using the disk being changed.

The project is Windows-aware and lab-oriented, with a clear separation between target workflows, UI exploration, and safety documentation.

## Operational Purpose

- Provide a controlled planning surface for workflow partitioning and review.
- Keep validation and lab scenarios separate from live operational execution.
- Make unsupported behavior explicit instead of leaving it implied.
- Preserve safety boundaries for workflows that may later connect to real systems.

## Design Posture

- Read-only first.
- Backup-first before any future execution path.
- External-drive-paired for any workflow that could ever mutate partitions.
- Simulation before execution.
- Lab documentation alongside implementation.
- Explicit Windows compatibility considerations.
- Tauri/Rust boundary for local desktop behavior.

## Architecture

```text
src-tauri/      Tauri/Rust desktop backend
src/            Frontend app surface
lab/            Lab harness, scenario notes, and workflow validation
docs/           Architecture, safety, Windows, and handoff documentation
package.json    Root scripts for development, checks, and packaging
```

## Current State

- The desktop app is the active surface.
- The current scope is planning, simulation, and lab validation.
- The lab harness documents target workflows, UI expectations, image workflow notes, and not-yet-implemented behavior.
- Safety boundaries are documented as part of the product, not treated as future cleanup.

## Deployment Posture

Partition is a local desktop and lab-validation project. It should not be connected to live mutation workflows until the read-only boundary, safety model, external-drive backup requirement, and workflow execution contracts are deliberately changed.

## Working Locally

```bash
npm install
npm run dev
npm run check
npm run test
npm run tauri
npm run verify:handoffs
```

Use the lab scripts when validating documented scenarios rather than product runtime behavior.

## Local Tooling

The shared local machine baseline supports Partition's Tauri/Rust safety work:

- Use `cargo audit`, `cargo deny`, and `sccache` around Rust and Tauri changes.
- Use `actionlint` before changing GitHub Actions workflows.
- Use `shellcheck` and `shfmt` when editing lab or verification scripts.
- Use `osv-scanner` for dependency advisory checks across package manifests.

## Direction

- Keep the planning surface constrained and inspectable.
- Require an external backup destination before designing any destructive execution path.
- Expand lab coverage before adding operational execution.
- Preserve Windows compatibility as part of the product contract.
- Make unsupported actions visible to operators.

## Related Documentation

- [Architecture](docs/architecture.md)
- [Safety](docs/safety.md)
- [Windows](docs/windows.md)
- [Lab Harness](lab/README.md)
