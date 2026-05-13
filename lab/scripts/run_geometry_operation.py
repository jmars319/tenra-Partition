#!/usr/bin/env python3
"""Execute geometry-only C/E operations against disposable raw image work copies."""

from __future__ import annotations

import argparse
import errno
import hashlib
import json
import os
import shutil
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from command_plan import build_command_plan, workflow_min_free
from create_image import write_gpt_image
from inspect_image import load_image_manifest, manifest_path_for_image, normalize_raw_layout, parse_raw_partition_table
from partitionlab_common import (
    PROJECT_ROOT,
    TEST_IMAGES_DIR,
    LayoutError,
    find_partition,
    load_json,
    parse_size,
    partition_size_bytes,
    print_json,
    safety_assessment,
    sector_size,
)
from verify_layout import compare_layouts


SCHEMA_GEOMETRY_RUN = "partition-lab.geometry-run.v1"
RUNS_DIR = PROJECT_ROOT / "runs"
COPY_CHUNK_BYTES = 1024 * 1024


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def copy_sparse_file(source: Path, destination: Path) -> None:
    size = source.stat().st_size
    with source.open("rb") as src, destination.open("wb") as dst:
        dst.truncate(size)
        if hasattr(os, "SEEK_DATA") and hasattr(os, "SEEK_HOLE"):
            src_fd = src.fileno()
            offset = 0
            while offset < size:
                try:
                    data_start = os.lseek(src_fd, offset, os.SEEK_DATA)
                except OSError as exc:
                    if exc.errno in {errno.ENXIO, errno.ENODATA}:
                        break
                    raise
                data_end = os.lseek(src_fd, data_start, os.SEEK_HOLE)
                remaining = data_end - data_start
                src.seek(data_start)
                dst.seek(data_start)
                while remaining > 0:
                    chunk = src.read(min(COPY_CHUNK_BYTES, remaining))
                    if not chunk:
                        break
                    dst.write(chunk)
                    remaining -= len(chunk)
                offset = data_end
            return

        offset = 0
        while True:
            chunk = src.read(COPY_CHUNK_BYTES)
            if not chunk:
                break
            if chunk.strip(b"\0"):
                dst.seek(offset)
                dst.write(chunk)
            offset += len(chunk)


def copy_work_image(source_image: Path, run_dir: Path) -> Path:
    work_image = run_dir / f"{source_image.stem}.work{source_image.suffix}"
    copy_sparse_file(source_image, work_image)
    source_manifest = manifest_path_for_image(source_image)
    if source_manifest.exists():
        shutil.copy2(source_manifest, manifest_path_for_image(work_image))
    return work_image


def sha256_regions(path: Path, regions: list[tuple[int, int]]) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for offset, size in regions:
            handle.seek(offset)
            remaining = size
            while remaining > 0:
                chunk = handle.read(min(COPY_CHUNK_BYTES, remaining))
                if not chunk:
                    break
                digest.update(chunk)
                remaining -= len(chunk)
    return digest.hexdigest()


def fingerprint_regions(layout: dict[str, Any]) -> list[tuple[int, int]]:
    image_path = Path(layout["image"]["path"])
    bytes_per_sector = sector_size(layout)
    size = image_path.stat().st_size
    regions = [(0, min(34 * bytes_per_sector, size))]
    if size > 34 * bytes_per_sector:
        regions.append((max(0, size - 34 * bytes_per_sector), min(34 * bytes_per_sector, size)))
    for partition in layout["disk"]["partitions"]:
        marker = partition.get("payload_marker")
        if isinstance(marker, dict):
            offset = int(partition["start_sector"]) * bytes_per_sector + int(marker["offset_bytes"])
            regions.append((offset, int(marker["size_bytes"])))
    return regions


def copy_range_backward(path: Path, source_offset: int, destination_offset: int, length: int) -> None:
    with path.open("r+b") as handle:
        remaining = length
        while remaining > 0:
            chunk_size = min(COPY_CHUNK_BYTES, remaining)
            position = remaining - chunk_size
            handle.seek(source_offset + position)
            chunk = handle.read(chunk_size)
            handle.seek(destination_offset + position)
            handle.write(chunk)
            remaining -= chunk_size


def zero_range(path: Path, offset: int, length: int) -> None:
    zero = b"\0" * min(COPY_CHUNK_BYTES, max(0, length))
    if not zero:
        return
    with path.open("r+b") as handle:
        remaining = length
        handle.seek(offset)
        while remaining > 0:
            chunk = zero if remaining >= len(zero) else zero[:remaining]
            handle.write(chunk)
            remaining -= len(chunk)


def update_work_manifest(
    work_image: Path,
    before_layout: dict[str, Any],
    increase_bytes: int,
    target_label: str,
    source_label: str,
) -> dict[str, Any]:
    manifest_path = manifest_path_for_image(work_image)
    manifest = load_json(manifest_path)
    bytes_per_sector = sector_size(before_layout)
    increase_sectors = increase_bytes // bytes_per_sector

    for partition in manifest["disk"]["partitions"]:
        label = str(partition.get("label", "")).upper()
        if label == target_label.upper():
            partition["end_sector"] = int(partition["end_sector"]) + increase_sectors
            partition["free_bytes"] = int(partition.get("free_bytes", 0)) + increase_bytes
        elif label == source_label.upper():
            partition["start_sector"] = int(partition["start_sector"]) + increase_sectors
            partition["free_bytes"] = int(partition.get("free_bytes", 0)) - increase_bytes

    manifest["image"] = str(work_image)
    manifest["derived_from"] = before_layout["image"]["path"]
    manifest["updated_at_utc"] = datetime.now(timezone.utc).isoformat()
    write_json(manifest_path, manifest)
    return manifest


def apply_geometry(work_image: Path, before_layout: dict[str, Any], increase_bytes: int, target_label: str, source_label: str) -> None:
    bytes_per_sector = sector_size(before_layout)
    if increase_bytes % bytes_per_sector:
        raise LayoutError("increase is not sector aligned")
    increase_sectors = increase_bytes // bytes_per_sector
    target = find_partition(before_layout, target_label)
    source = find_partition(before_layout, source_label)
    source_size = partition_size_bytes(source, bytes_per_sector)
    moved_source_size = source_size - increase_bytes
    if moved_source_size <= 0:
        raise LayoutError("source partition would be empty after geometry operation")

    source_offset = int(source["start_sector"]) * bytes_per_sector
    destination_offset = (int(source["start_sector"]) + increase_sectors) * bytes_per_sector
    copy_range_backward(work_image, source_offset, destination_offset, moved_source_size)
    zero_range(work_image, source_offset, increase_bytes)

    partitions: list[dict[str, Any]] = []
    for partition in before_layout["disk"]["partitions"]:
        item = {
            "number": int(partition["number"]),
            "label": str(partition.get("label") or partition.get("name") or partition["number"]),
            "start_sector": int(partition["start_sector"]),
            "end_sector": int(partition["end_sector"]),
        }
        if item["label"].upper() == target_label.upper():
            item["end_sector"] += increase_sectors
        elif item["label"].upper() == source_label.upper():
            item["start_sector"] += increase_sectors
        partitions.append(item)

    write_gpt_image(work_image, work_image.stat().st_size, sorted(partitions, key=lambda item: item["number"]))
    update_work_manifest(work_image, before_layout, increase_bytes, target_label, source_label)


def load_layout_from_image(image: Path) -> dict[str, Any]:
    raw = parse_raw_partition_table(image)
    if not raw:
        raise LayoutError("no raw GPT/MBR partition table was parsed")
    manifest = load_image_manifest(image)
    return normalize_raw_layout(image, raw, manifest)


def build_checks(
    before_layout: dict[str, Any],
    after_layout: dict[str, Any],
    verification: dict[str, Any],
    source_fingerprint_before: str,
    source_fingerprint_after: str,
) -> list[dict[str, Any]]:
    payload_checks = [
        {
            "name": f"{partition['label']} payload marker hash",
            "status": "pass" if partition.get("payload_marker", {}).get("hash_ok") else "fail",
            "details": partition.get("payload_marker", {}),
        }
        for partition in after_layout["disk"]["partitions"]
        if isinstance(partition.get("payload_marker"), dict)
    ]
    return [
        {
            "name": "source image fingerprint unchanged",
            "status": "pass" if source_fingerprint_before == source_fingerprint_after else "fail",
            "details": {
                "before": source_fingerprint_before,
                "after": source_fingerprint_after,
            },
        },
        {
            "name": "verification passed",
            "status": "pass" if verification["verification_status"] == "pass" else "fail",
            "details": {"verification_status": verification["verification_status"]},
        },
        *payload_checks,
    ]


def run_geometry_operation(
    image: Path,
    increase_bytes: int,
    target_label: str,
    source_label: str,
    min_source_free_after_bytes: Optional[int],
    acknowledged: bool,
) -> dict[str, Any]:
    safety = safety_assessment(image)
    if safety["denylisted_system_device"]:
        raise LayoutError(f"refusing system block device: {safety['resolved_path']}")
    if safety["block_device"] or safety["windows_physical_drive"]:
        raise LayoutError("refusing block device for geometry-only image mode")
    if not safety["under_test_images"]:
        raise LayoutError("image must be under test-images")
    if not image.exists():
        raise LayoutError(f"image not found: {image}")
    if not acknowledged:
        raise LayoutError("geometry write mode requires --i-understand-this-is-geometry-only")

    before_layout = load_layout_from_image(image)
    if min_source_free_after_bytes is None:
        min_source_free_after_bytes = workflow_min_free(before_layout)
    if before_layout["disk"]["label"] != "gpt":
        raise LayoutError("geometry execution currently supports GPT raw images only")

    command_plan = build_command_plan(before_layout, increase_bytes, target_label, source_label, min_source_free_after_bytes)
    if command_plan["modes"]["raw_geometry"]["status"] != "ready":
        raise LayoutError(f"raw geometry command plan is blocked: {command_plan['modes']['raw_geometry']['blockers']}")

    run_id = f"geometry-{utc_stamp()}-{uuid.uuid4().hex[:8]}"
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=False)
    work_image = copy_work_image(image, run_dir)

    source_fingerprint_before = sha256_regions(image, fingerprint_regions(before_layout))
    write_json(run_dir / "before-layout.json", before_layout)
    write_json(run_dir / "command-plan.json", command_plan)

    status = "pass"
    error: str | None = None
    verification: dict[str, Any]
    after_layout: dict[str, Any]
    try:
        apply_geometry(work_image, before_layout, increase_bytes, target_label, source_label)
        after_layout = load_layout_from_image(work_image)
        verification = compare_layouts(before_layout, after_layout, increase_bytes, target_label, source_label, min_source_free_after_bytes)
    except Exception as exc:  # Preserve failed work image and emit structured failure.
        status = "fail"
        error = str(exc)
        after_layout = load_layout_from_image(work_image)
        verification = {
            "schema": "partition-lab.verify.v1",
            "scenario": before_layout.get("scenario"),
            "verification_status": "fail",
            "checks": [{"name": "geometry operation completed", "status": "fail", "details": {"error": error}}],
        }

    source_fingerprint_after = sha256_regions(image, fingerprint_regions(before_layout))
    checks = build_checks(before_layout, after_layout, verification, source_fingerprint_before, source_fingerprint_after)
    if any(check["status"] != "pass" for check in checks):
        status = "fail"

    result = {
        "schema": SCHEMA_GEOMETRY_RUN,
        "run_id": run_id,
        "status": status,
        "error": error,
        "source_image": str(image.resolve(strict=False)),
        "work_image": str(work_image.resolve(strict=False)),
        "run_dir": str(run_dir.resolve(strict=False)),
        "input": {
            "target_label": target_label,
            "source_label": source_label,
            "increase_bytes": increase_bytes,
            "minimum_source_free_after_bytes": min_source_free_after_bytes,
        },
        "checks": checks,
        "verification": verification,
    }
    write_json(run_dir / "after-layout.json", after_layout)
    write_json(run_dir / "verification.json", verification)
    write_json(run_dir / "geometry-run.json", result)
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run geometry-only mutation against a disposable raw image work copy.")
    parser.add_argument("--image", required=True, help="Source raw image under test-images.")
    parser.add_argument("--increase-c", default="40G", help="Amount to add to C. Default: 40G.")
    parser.add_argument("--target", default="C", help="Target partition label. Default: C.")
    parser.add_argument("--source", default="E", help="Source partition label. Default: E.")
    parser.add_argument("--min-source-free-after", help="Minimum free bytes that must remain on source.")
    parser.add_argument(
        "--i-understand-this-is-geometry-only",
        action="store_true",
        help="Required acknowledgement for lab-only geometry writes to a work copy.",
    )
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        image = Path(args.image).resolve(strict=False)
        increase = parse_size(args.increase_c)
        min_free = parse_size(args.min_source_free_after) if args.min_source_free_after else None
        result = run_geometry_operation(
            image,
            increase,
            args.target,
            args.source,
            min_free,
            args.i_understand_this_is_geometry_only,
        )
    except (OSError, ValueError, LayoutError) as exc:
        parser.error(str(exc))

    if args.json:
        print_json(result)
    else:
        print(f"Run: {result['run_id']}")
        print(f"Status: {result['status']}")
        print(f"Work image: {result['work_image']}")
        print(f"Run dir: {result['run_dir']}")
        for check in result["checks"]:
            print(f"  {check['status'].upper()}: {check['name']}")

    return 0 if result["status"] == "pass" else 2


if __name__ == "__main__":
    sys.exit(main())
