# GParted Live Reference

This note records how the local GParted Live ISO can help move tenra Partition
from a read-only planner toward real disposable-image validation.

## Inspected Asset

- Workspace ISO from the repo root: `../gparted-live-1.8.1-3-amd64.iso`
- ISO label: `GParted-live`
- Live version: `GParted Live 1.8.1-3-amd64`
- Base: Debian Sid live snapshot, amd64, built `2026-04-04`
- Main payloads: `live/vmlinuz`, `live/initrd.img`, `live/filesystem.squashfs`,
  `live/filesystem.packages`

The ISO did not mount through `hdiutil` on this macOS host, but `bsdtar` can
inspect the ISO and extract package manifests without modifying it.

## Reuse Boundary

Use GParted Live as a reference toolchain and workflow model, not as vendored
application code.

Allowed:

- Study the operation model, validation posture, and package/tool selection.
- Invoke installed command-line tools in isolated lab environments.
- Boot the ISO in a VM against disposable disk images when QEMU or another VM
  runner is available.
- Compare tenra Partition plans with independent GParted Live behavior.

Avoid unless there is an explicit licensing plan:

- Copying GParted application source into this repository.
- Linking directly against GPL partition libraries from the Tauri app.
- Bundling the GParted Live ISO or its binaries as part of tenra Partition.

GParted is GPL-2.0-or-later. GNU Parted and libparted are GPL-3.0-or-later, and
libparted is not LGPL. Treat them as separate tools or a separate lab image
unless the project intentionally adopts compatible distribution obligations.

## Useful Toolchain Signal

The ISO package manifest confirms the mature stack that matters for Partition:

- Partition table and geometry: `parted`, `libparted`, `gdisk`, `fdisk`,
  `util-linux`, `kpartx`
- NTFS: `ntfs-3g`
- Linux filesystems: `e2fsprogs`, `btrfs-progs`, `xfsprogs`, `f2fs-tools`,
  `jfsutils`, `reiserfsprogs`, `nilfs-tools`
- FAT/exFAT/HFS: `dosfstools`, `exfatprogs`, `hfsprogs`, `hfsutils`, `mtools`
- Safety and device context: `cryptsetup`, `lvm2`, `mdadm`, `smartmontools`,
  `hdparm`, `udev`, `udisks2`
- Recovery and copy references: `gddrescue`, `testdisk`, `partclone`,
  `fsarchiver`

For the current C/E NTFS workflow, the immediate reference stack is smaller:

- Probe layout and free space with `parted`/`libparted` and sector units.
- Validate GPT state with `sgdisk`/`gdisk`-style checks.
- Inspect NTFS minimum size and dirty state with `ntfsresize`/`ntfs-3g` tools.
- Refuse mounted, encrypted, dirty, unsupported, or non-adjacent layouts.
- Execute only inside disposable images until recovery behavior is proven.

## Operation Mapping

The current tenra Partition workflow already matches the core shape:

```text
Initial: [C: NTFS][E: NTFS with free space]
Goal:    [C: larger][E: smaller and moved right]
```

Reference execution phases for disposable images:

1. Snapshot or clone the image before mutation.
2. Read partition table and filesystem state.
3. Verify the requested size does not cross the source filesystem minimum.
4. Shrink the E filesystem.
5. Shrink the E partition boundary.
6. Move E right with a collision-safe copy/move strategy.
7. Expand the C partition boundary.
8. Grow the C filesystem.
9. Re-read the disk and verify expected geometry, filesystem sizes, and data
   checksums.

The move step is the highest-risk piece. It should stay unavailable in write
mode until the lab can prove interruption recovery against disposable images.

## Near-Term Implementation Path

1. Keep the desktop app read-only and continue exporting explicit operation
   plans.
2. Extend `inspect_image.py --json` into a normalizer that emits
   `partition-lab.disk-layout.v1` from real raw images.
3. Add host tool discovery for `parted`, `sgdisk`, `ntfsresize`, `qemu-img`,
   and a VM runner, reporting missing tools as lab blockers.
4. Add a VM/lab mode that boots GParted Live or another Linux rescue image
   against a cloned disposable disk image.
5. Add dry-run command plans that name tools and preconditions but still refuse
   writes.
6. Enable destructive mode only for disposable images under `test-images/`, with
   an image snapshot, explicit acknowledgement, post-checks, and logs.
7. Decide separately whether tenra Partition should ever execute against
   physical disks. That is not implied by the GParted Live reference.

## Design Lessons To Preserve

- Operations should be queued, reviewable, and applied as an explicit batch.
- Filesystem support is capability-driven: a feature is available only when the
  required native tool exists and the filesystem state is safe.
- Warnings should be conservative around boot partitions, MBR layouts, dirty
  filesystems, and mounted volumes.
- The UI planner should remain separate from the mutation backend.
- Lab validation must prove the exact geometry and data-survival contract before
  any operation leaves local layout mode.

## References

- GParted project features and supported filesystem operations:
  <https://gparted.org/features.php>
- GParted FAQ on dependencies, filesystem-native tools, mounted partitions, and
  operation safety: <https://gparted.org/faq.php>
- GParted project licensing statement:
  <https://gparted.org/index.php>
- GNU Parted manual and licensing notes:
  <https://www.gnu.org/software/parted/manual/parted.html>
