#!/usr/bin/env python3
"""Run the final macOS validation gate before Windows testing."""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from discover_capabilities import discover_capabilities
from partitionlab_common import PROJECT_ROOT, print_json
from run_scenario_batch import build_batch_report
from vm_plan import build_vm_plan


SCHEMA_MAC_GATE = "partition-lab.mac-gate.v1"
RUNS_DIR = PROJECT_ROOT / "runs"
REPO_ROOT = PROJECT_ROOT.parent


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def check_ignored(path: str | Path) -> dict[str, Any]:
    candidate = Path(path)
    if candidate.is_absolute():
        try:
            display_path = str(candidate.relative_to(REPO_ROOT))
        except ValueError:
            display_path = str(candidate)
    else:
        display_path = str(candidate)
    completed = subprocess.run(
        ["git", "check-ignore", "-q", display_path],
        cwd=REPO_ROOT,
        check=False,
        text=True,
        capture_output=True,
    )
    return {
        "path": display_path,
        "ignored": completed.returncode == 0,
        "returncode": completed.returncode,
    }


def generated_artifact_paths(batch_report: dict[str, Any], vm_plan: dict[str, Any] | None, gate_dir: Path) -> list[str]:
    paths = [
        str(gate_dir),
        str(gate_dir / "mac-gate.json"),
        str(batch_report.get("run_dir", "")),
        str(Path(str(batch_report.get("run_dir", ""))) / "batch-report.json"),
    ]
    for scenario in batch_report.get("scenarios", []):
        artifacts = scenario.get("artifacts", {})
        if isinstance(artifacts, dict):
            paths.extend(str(value) for value in artifacts.values() if value)
    if vm_plan:
        if vm_plan.get("run_dir"):
            paths.append(str(vm_plan["run_dir"]))
            paths.append(str(Path(str(vm_plan["run_dir"])) / "vm-plan.json"))
        work_image = vm_plan.get("work_image")
        if isinstance(work_image, dict):
            paths.extend(str(value) for value in work_image.values() if value)
    return sorted(set(path for path in paths if path))


def representative_vm_source(batch_report: dict[str, Any]) -> Path | None:
    for scenario in batch_report.get("scenarios", []):
        if scenario.get("status") == "pass":
            image = scenario.get("artifacts", {}).get("image")
            if image:
                return Path(image)
    return None


def readiness_status(batch_report: dict[str, Any], ignore_checks: list[dict[str, Any]]) -> str:
    summary = batch_report.get("summary", {})
    if int(summary.get("fail", 1)) > 0:
        return "failed"
    if int(summary.get("pass", 0)) < 1 or int(summary.get("blocked", 0)) < 1:
        return "blocked"
    if any(not check["ignored"] for check in ignore_checks):
        return "failed"
    return "ready-for-windows"


def build_mac_gate(run_optional_checks: bool = True, build_vm: bool = True) -> dict[str, Any]:
    gate_id = f"mac-gate-{utc_stamp()}-{uuid.uuid4().hex[:8]}"
    gate_dir = RUNS_DIR / gate_id
    gate_dir.mkdir(parents=True, exist_ok=False)
    capabilities = discover_capabilities()
    batch_report = build_batch_report(run_optional_checks=run_optional_checks, convert_qcow2=False)

    vm_plan: dict[str, Any] | None = None
    vm_source = representative_vm_source(batch_report)
    if build_vm and vm_source:
        vm_plan = build_vm_plan(vm_source)

    ignore_checks = [
        check_ignored(path)
        for path in generated_artifact_paths(batch_report, vm_plan, gate_dir)
    ]
    status = readiness_status(batch_report, ignore_checks)
    blockers: list[dict[str, str]] = []
    if batch_report.get("summary", {}).get("fail", 0):
        blockers.append({"id": "batch-failures", "message": "one or more batch scenarios failed"})
    if any(not check["ignored"] for check in ignore_checks):
        blockers.append({"id": "generated-artifact-not-ignored", "message": "one or more generated artifacts are not ignored by git"})

    gate = {
        "schema": SCHEMA_MAC_GATE,
        "gate_id": gate_id,
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "status": status,
        "run_dir": str(gate_dir),
        "capabilities": capabilities,
        "batch_report": {
            "batch_id": batch_report["batch_id"],
            "path": str(Path(batch_report["run_dir"]) / "batch-report.json"),
            "summary": batch_report["summary"],
        },
        "vm_plan": None
        if vm_plan is None
        else {
            "plan_id": vm_plan["plan_id"],
            "status": vm_plan["status"],
            "path": str(Path(vm_plan["run_dir"]) / "vm-plan.json") if vm_plan.get("run_dir") else None,
            "blockers": vm_plan.get("blockers", []),
        },
        "checks": {
            "batch_has_no_failures": batch_report["summary"]["fail"] == 0,
            "batch_has_passed_geometry": batch_report["summary"]["pass"] > 0,
            "batch_has_blocked_guardrails": batch_report["summary"]["blocked"] > 0,
            "generated_artifacts_ignored": all(check["ignored"] for check in ignore_checks),
        },
        "ignored_artifacts": ignore_checks,
        "blockers": blockers,
        "next": {
            "windows_handoff": "Run create_windows_handoff.py from this repository before switching hosts.",
            "windows_phase": "Validate real VHDX/NTFS behavior on Windows before implementing mutation.",
        },
    }
    write_json(gate_dir / "mac-gate.json", gate)
    return gate


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the macOS pre-Windows validation gate.")
    parser.add_argument("--skip-optional-checks", action="store_true", help="Skip optional sgdisk/qemu-img checks in the batch runner.")
    parser.add_argument("--skip-vm-plan", action="store_true", help="Do not generate a GParted Live VM plan.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        gate = build_mac_gate(not args.skip_optional_checks, not args.skip_vm_plan)
    except (OSError, ValueError) as exc:
        parser.error(str(exc))

    if args.json:
        print_json(gate)
    else:
        print(f"Gate: {gate['gate_id']}")
        print(f"Status: {gate['status']}")
        print(
            "Batch: "
            f"{gate['batch_report']['summary']['pass']} pass, "
            f"{gate['batch_report']['summary']['blocked']} blocked, "
            f"{gate['batch_report']['summary']['fail']} fail"
        )
        print(f"Report: {gate['run_dir']}/mac-gate.json")
    return 0 if gate["status"] == "ready-for-windows" else 2


if __name__ == "__main__":
    sys.exit(main())
