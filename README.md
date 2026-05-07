# tenra Partition

tenra Partition is a read-only planning, simulation, and lab-validation app. It is designed to help operators reason about workflows and safety boundaries without letting the planning surface mutate live systems.

The project is Windows-aware and lab-oriented, with a clear separation between target workflows, UI exploration, and safety documentation.

## Operational Purpose

- Provide a controlled planning surface for workflow partitioning and review.
- Keep validation and lab scenarios separate from live operational execution.
- Make unsupported behavior explicit instead of leaving it implied.
- Preserve safety boundaries for workflows that may later connect to real systems.

## Design Posture

- Read-only first.
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

Partition is a local desktop and lab-validation project. It should not be connected to live mutation workflows until the read-only boundary, safety model, and workflow execution contracts are deliberately changed.

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

## Direction

- Keep the planning surface constrained and inspectable.
- Expand lab coverage before adding operational execution.
- Preserve Windows compatibility as part of the product contract.
- Make unsupported actions visible to operators.

## Related Documentation

- [Architecture](docs/architecture.md)
- [Safety](docs/safety.md)
- [Windows](docs/windows.md)
- [Lab Harness](lab/README.md)
