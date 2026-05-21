# Safety Notes

tenra Partition is not production-safe partitioning software. The current implementation is a read-only visualizer, operation planner, simulator, and integrated lab harness.

Future execution must be designed as backup-first and external-drive-paired. A destructive workflow should not become available unless the operator has a verified backup destination outside the disk being changed and the lab harness can prove the restore path against disposable media.

The safety validator currently detects:

- Unknown or unsupported filesystem type
- Mounted partitions
- Encrypted or BitLocker-placeholder partitions
- Dirty filesystem placeholder
- Insufficient shrinkable free space
- Non-adjacent source and target partitions
- Unsupported partition table type
- Alignment issues
- Unsupported movement or resize operations

Blocking findings refuse the operation plan. Even when the plan is ready, execution remains disabled.

## Future Execution Gate

- Execution remains disabled in the app.
- Future destructive execution must require an external backup drive before partition work starts.
- The backup destination must be separate from the disk being resized, moved, or repaired.
- Lab validation must prove both the partition operation and the restore process against disposable images before any live path is considered.
