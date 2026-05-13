# Not Implemented Yet

The project intentionally does not implement these items yet:

- Real destructive partition mutation.
- Real NTFS shrink, move, or grow operations.
- Windows VHDX mutation beyond create, inspect, reset, and guarded refusal.
- Physical disk mutation of any kind.
- Crash recovery after an interrupted real move.
- BitLocker or encrypted-volume handling.
- Dirty NTFS repair.
- VM orchestration.
- GUI or app frontend.
- Production safety guarantees.

The current lab can normalize disposable raw image layouts and run geometry-only
mutation against work copies. The next implementation step is real NTFS
shrink/grow validation in a disposable VM or Windows-admin VHDX path. Only after
that should real filesystem mutation be considered.
The GParted Live ISO can be used as a reference and future VM payload for this
work, but it does not make write-mode execution available by itself.
