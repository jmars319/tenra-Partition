# Raw Image Safety Matrix

The pure-Python lab path is safe-to-test only for disposable raw images under
`test-images/` and per-run work copies under `runs/`.

## Scenario Presets

`scripts/create_image.py --scenario <name>` supports these local presets:

| Scenario | Expected result |
| --- | --- |
| `normal-c-e-layout` | Raw geometry command plan is ready. |
| `gpt-layout` | Same geometry shape as the normal C/E GPT scenario. |
| `e-has-insufficient-free-space` | Planner blocks with `source-free-insufficient`. |
| `mbr-layout` | Command plan blocks with `partition-table-not-gpt`. |
| `non-adjacent-free-space` | Planner blocks with `partition-adjacency`. |
| `unaligned-layout` | Layout validation blocks with `layout-invalid`. |
| `dirty-filesystem-placeholder` | Planner blocks with `source-filesystem-state`. |
| `encrypted-filesystem-placeholder` | Planner blocks with `source-encrypted`. |
| `interrupted-operation-placeholder` | Planner blocks with `operation-state`. |
| `corrupted-payload-marker` | Manifest validation blocks with `payload-marker-hash-mismatch`. |
| `malformed-manifest` | Inspection refuses before layout normalization. |

Missing manifests are tested by deleting the generated
`.raw.img.manifest.json` sidecar before inspection.

## Interruption Simulation

`scripts/run_geometry_operation.py` accepts:

```bash
--simulate-interruption snapshot
--simulate-interruption byte-move
--simulate-interruption gpt-rewrite
--simulate-interruption manifest-update
--simulate-interruption verification
```

Interrupted runs return `partition-lab.geometry-run.v1` with `status: fail`,
`failure_class`, `preflight`, `postflight`, and preserved artifact paths. Work
manifests are marked unsafe when a work image exists.

## Artifact Imports

The desktop app can import these read-only lab artifacts:

- `partition-lab.capabilities.v1`
- `partition-lab.command-plan.v1`
- `partition-lab.geometry-run.v1`
- `partition-lab.verify.v1`

The app displays them for review only. It does not execute lab scripts.

