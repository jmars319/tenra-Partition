# Safety Model

tenra Partition Lab is for disposable assets only.

Default behavior is local layout mode. Local layout mode reads JSON layouts and produces plans or verification reports without touching a disk image or block device.

Windows compatibility is a Day 1 requirement. The preferred real-image mode on Windows is VHDX, created and attached with `diskpart` through PowerShell scripts.

Image mode is limited to regular files under `test-images/`. Scripts that create or inspect images check this path boundary by default.

Geometry-only raw mode creates a per-run work copy under `runs/` and mutates
only that work copy. It requires an explicit geometry-only acknowledgement and
does not run NTFS shrink or grow commands.

The raw-image scenario matrix covers ready, blocked, malformed, corrupted, and
interrupted states. See [raw-image-safety-matrix.md](raw-image-safety-matrix.md).

Loop-device mode is limited to loop devices created from lab images. Scripts refuse block devices by default, and future write-mode scripts must require explicit lab-device flags.

Future VM mode is not implemented.

Known system disks are denied by name:

- `\\.\PhysicalDrive0`
- `\\?\PhysicalDrive0`
- `PhysicalDrive0`
- `C:`
- `/dev/sda`
- `/dev/nvme0n1`
- `/dev/vda`
- `/dev/xvda`
- `/dev/disk0`

The project currently includes guarded entrypoints only:

- `scripts/run-destructive-image-operation.ps1`
- `scripts/run_destructive_image_operation.sh`

They log the target and inspection command, require an explicit destructive
acknowledgement for write mode, delegate only explicit geometry-only lab runs,
then refuse real NTFS mutation.
