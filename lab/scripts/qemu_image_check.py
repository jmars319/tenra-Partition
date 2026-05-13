#!/usr/bin/env python3
"""Validate disposable raw images with qemu-img and optionally convert work copies."""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from partitionlab_common import PROJECT_ROOT, TEST_IMAGES_DIR, path_is_under, print_json, safety_assessment


SCHEMA_QEMU_IMAGE_CHECK = "partition-lab.qemu-image-check.v1"
RUNS_DIR = PROJECT_ROOT / "runs"
FINGERPRINT_REGION_BYTES = 1024 * 1024


def blocker(blocker_id: str, message: str) -> dict[str, str]:
    return {"id": blocker_id, "message": message}


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def run_command(command: list[str]) -> dict[str, Any]:
    try:
        completed = subprocess.run(command, check=False, text=True, capture_output=True)
        return {
            "cmd": command,
            "returncode": completed.returncode,
            "stdout": completed.stdout,
            "stderr": completed.stderr,
        }
    except OSError as exc:
        return {
            "cmd": command,
            "returncode": 127,
            "stdout": "",
            "stderr": str(exc),
        }


def image_fingerprint(path: Path) -> dict[str, Any]:
    size = path.stat().st_size
    regions = [(0, min(FINGERPRINT_REGION_BYTES, size))]
    if size > FINGERPRINT_REGION_BYTES:
        regions.append((max(0, size - FINGERPRINT_REGION_BYTES), min(FINGERPRINT_REGION_BYTES, size)))
    digest = hashlib.sha256()
    digest.update(str(size).encode("utf-8"))
    with path.open("rb") as handle:
        for offset, length in regions:
            handle.seek(offset)
            digest.update(offset.to_bytes(16, "little"))
            digest.update(handle.read(length))
    return {
        "algorithm": "sha256",
        "scope": "size-first-last-1MiB",
        "value": digest.hexdigest(),
        "size_bytes": size,
        "regions": [{"offset": offset, "size_bytes": length} for offset, length in regions],
    }


def parse_info(result: dict[str, Any]) -> dict[str, Any] | None:
    if result["returncode"] != 0:
        return None
    try:
        return json.loads(result["stdout"])
    except json.JSONDecodeError:
        return None


def default_qcow2_output(image: Path) -> Path:
    run_dir = RUNS_DIR / f"qemu-img-{utc_stamp()}-{uuid.uuid4().hex[:8]}"
    return run_dir / f"{image.stem}.qcow2"


def validate_output_path(output: Path) -> Path:
    output = output.resolve(strict=False)
    if not path_is_under(RUNS_DIR, output):
        raise ValueError(f"qcow2 output must be under {RUNS_DIR}")
    return output


def qemu_image_check(
    image: Path,
    convert_qcow2: bool = False,
    qcow2_output: Path | None = None,
    allow_outside_test_images: bool = False,
) -> dict[str, Any]:
    image = image.resolve(strict=False)
    safety = safety_assessment(image)
    if not safety["under_test_images"] and not allow_outside_test_images:
        raise ValueError("image must be under test-images unless --allow-outside-test-images is set")
    if safety["block_device"] or safety["windows_physical_drive"] or safety["denylisted_system_device"]:
        raise ValueError("refusing block or system device for qemu-img validation")
    if not image.exists():
        raise ValueError(f"image not found: {image}")

    qemu_img = shutil.which("qemu-img")
    if not qemu_img:
        return {
            "schema": SCHEMA_QEMU_IMAGE_CHECK,
            "image": str(image),
            "status": "blocked",
            "blockers": [blocker("qemu-img-missing", "qemu-img is not installed")],
            "commands": [],
        }

    source_fingerprint_before = image_fingerprint(image)
    info_result = run_command([qemu_img, "info", "--output=json", str(image)])
    commands = [info_result]
    info = parse_info(info_result)
    blockers: list[dict[str, str]] = []
    if not info:
        blockers.append(blocker("qemu-img-info-failed", "qemu-img info did not return valid JSON"))
    else:
        if info.get("format") != "raw":
            blockers.append(blocker("qemu-img-format-mismatch", f"expected raw image, got {info.get('format')}"))
        if int(info.get("virtual-size", -1)) != image.stat().st_size:
            blockers.append(blocker("qemu-img-size-mismatch", "qemu-img virtual size differs from filesystem size"))

    conversion: dict[str, Any] | None = None
    if convert_qcow2:
        output = validate_output_path(qcow2_output or default_qcow2_output(image))
        output.parent.mkdir(parents=True, exist_ok=True)
        convert_result = run_command([qemu_img, "convert", "-f", "raw", "-O", "qcow2", str(image), str(output)])
        commands.append(convert_result)
        output_info_result: dict[str, Any] | None = None
        output_info = None
        if convert_result["returncode"] == 0:
            output_info_result = run_command([qemu_img, "info", "--output=json", str(output)])
            commands.append(output_info_result)
            output_info = parse_info(output_info_result)
            if not output_info or output_info.get("format") != "qcow2":
                blockers.append(blocker("qemu-img-convert-failed", "converted image did not inspect as qcow2"))
        else:
            blockers.append(blocker("qemu-img-convert-failed", "qemu-img convert failed"))
        conversion = {
            "requested": True,
            "output": str(output),
            "status": "pass" if convert_result["returncode"] == 0 and output_info and output_info.get("format") == "qcow2" else "fail",
            "info": output_info,
        }
    else:
        conversion = {"requested": False}

    source_fingerprint_after = image_fingerprint(image)
    if source_fingerprint_before["value"] != source_fingerprint_after["value"]:
        blockers.append(blocker("qemu-img-source-mutated", "source image fingerprint changed during qemu-img validation"))

    return {
        "schema": SCHEMA_QEMU_IMAGE_CHECK,
        "image": str(image),
        "status": "pass" if not blockers else "fail",
        "blockers": blockers,
        "info": info,
        "conversion": conversion,
        "source_fingerprint": {
            "before": source_fingerprint_before,
            "after": source_fingerprint_after,
            "unchanged": source_fingerprint_before["value"] == source_fingerprint_after["value"],
        },
        "commands": commands,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate a disposable raw image with qemu-img.")
    parser.add_argument("--image", required=True, help="Raw image under lab/test-images.")
    parser.add_argument("--convert-qcow2", action="store_true", help="Convert the raw image to qcow2 under lab/runs.")
    parser.add_argument("--qcow2-output", help="Optional qcow2 output path. Must be under lab/runs.")
    parser.add_argument("--allow-outside-test-images", action="store_true", help="Allow read-only validation outside test-images.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result = qemu_image_check(
            Path(args.image),
            args.convert_qcow2,
            Path(args.qcow2_output) if args.qcow2_output else None,
            args.allow_outside_test_images,
        )
    except (OSError, ValueError) as exc:
        parser.error(str(exc))

    if args.json:
        print_json(result)
    else:
        print(f"Image: {result['image']}")
        print(f"Status: {result['status']}")
        if result["blockers"]:
            print(f"Blockers: {', '.join(item['id'] for item in result['blockers'])}")
    return 0 if result["status"] == "pass" else 2


if __name__ == "__main__":
    sys.exit(main())
