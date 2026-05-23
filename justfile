set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

default:
    @just --list

verify:
    npm run check

doctor:
    just verify

actions:
    actionlint

security-audit:
    osv-scanner scan source --allow-no-lockfiles --config ./osv-scanner.toml --lockfile 'package-lock.json' --lockfile 'src-tauri/Cargo.lock'

rust-security:
    cd 'src-tauri' && cargo audit --ignore RUSTSEC-2024-0370 --ignore RUSTSEC-2024-0411 --ignore RUSTSEC-2024-0412 --ignore RUSTSEC-2024-0413 --ignore RUSTSEC-2024-0414 --ignore RUSTSEC-2024-0415 --ignore RUSTSEC-2024-0416 --ignore RUSTSEC-2024-0417 --ignore RUSTSEC-2024-0418 --ignore RUSTSEC-2024-0419 --ignore RUSTSEC-2024-0420 --ignore RUSTSEC-2024-0429 --ignore RUSTSEC-2025-0075 --ignore RUSTSEC-2025-0080 --ignore RUSTSEC-2025-0081 --ignore RUSTSEC-2025-0098 --ignore RUSTSEC-2025-0100
    cd 'src-tauri' && cargo deny check advisories

security:
    just actions
    just security-audit
    just rust-security
