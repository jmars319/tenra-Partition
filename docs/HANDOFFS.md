# tenra Partition Handoffs

tenra Partition stays unique because disk planning and eventual execution safety are specialized and high-risk.

## Produces

- `tenra-partition.operation-plan.v1`.
- `tenra-partition.safety-report.v1`.
- `tenra-partition.lab-validation-request.v1`, which must keep `execution.enabled` false.

## Consumes

- `partition-lab.disk-layout.v1` fixture/layout exports.
- Read-only lab validation requests for replay and disposable-image validation.

Partition should not receive hidden filesystem state from other repos. Every layout, plan, report, and lab request must cross an explicit file or local API boundary.
