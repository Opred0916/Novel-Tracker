# SDD ledger — plan: docs/superpowers/plans/2026-10-03-open-data-export.md

Pre-flight: Task 1 produces `OpenExportDocument`, `OpenExportTextName`, `OpenExportProgress`, and `createOpenExportFiles()` consumed by Tasks 2–4; Task 2 produces `OpenExportArchive.write()` consumed by Task 3; Task 3 produces `OpenExportService` consumed by Task 4; Task 4 consumes the existing `BackupCounts`, `BackupSnapshot`, `BackupFileStorage`, `SqliteBackupRepository`, and `BackupFilePort` interfaces.

Ruling: Open export keeps a separate format version and is read-only — the existing `.noveltracker` backup remains the only supported in-app restore format, because the spec requires a human-readable portable copy without expanding scope into an import/merge system.

Task 1: complete — serializer/types implemented in commit `ef98767`; focused serializer tests passed (3/3).

Task 2: complete — streaming ZIP archive with image deduplication, limits, and cleanup implemented in commit `8c8cbae`; archive plus backup-archive regression tests passed (17/17).

Task 3: complete — single-flight export lifecycle, timestamped output, temporary-operation cleanup, and sharing handoff result implemented; focused export-service and backup-service regression tests passed (12/12).
