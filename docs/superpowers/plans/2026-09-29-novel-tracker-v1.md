# Novel Tracker V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reliable, offline iPhone novel log with manual entry, notes, reviews, search, cover images and complete backup/restore.

**Architecture:** Expo / React Native with TypeScript; screens call a small service layer, which owns validation and a repository interface over SQLite. Cover files live in the app document directory. A versioned backup service serializes records and image bytes, validates imports before replacing the database and cover directory.

**Tech Stack:** Expo Router, TypeScript, `expo-sqlite`, `expo-file-system`, `expo-image-picker`, `expo-document-picker`, `expo-sharing`, Jest with `jest-expo` and React Native Testing Library. Install compatible packages using `npx expo install`; verify which SDK the user's App Store version of Expo Go supports before choosing the project SDK. Pin the verified SDK and package versions in the lockfile.

**Spec:** `novel-tracker-v1-spec.md` (copy the approved file into the repository as `docs/superpowers/specs/2026-09-29-novel-tracker-design.md` in Task 1). Section 8 is a future roadmap, not V1 implementation scope.

## Global Constraints

- Target iPhone first, Windows development, no paid service or Apple developer membership in the first phase.
- Only title is required; all other book fields are optional. Default status is `want_to_read`.
- States: `want_to_read`, `reading`, `finished`, `dropped`; rating is an optional integer from 1 through 5; duration is optional nonnegative hours.
- Multiple tags and notes per book, one editable review; same title is allowed on separate records.
- No account, persistent server, automatic book lookup, recommendation engine, reading timer, or cross-device sync in the core offline V1.
- A later AI-assisted entry flow may accept a user-selected screenshot, extract candidate book data, and optionally request network enrichment. Both extraction and enrichment require explicit user confirmation before saving and must degrade gracefully when offline.
- Backup is a versioned single file containing all records and copied covers. Restore validates before user-confirmed replacement; invalid input leaves current data untouched.
- The user performs physical iPhone checks with instructions and reports/screenshots supplied by Codex; a remote code run does not prove physical-device behavior.
- Before moving from Expo Go to a standalone app, export the data from Expo Go and explicitly import it into the new app; their local app storage is separate.
- Implement and verify in small slices, commit each task separately, and give the user a working checkpoint after each feature group.

## Review Focus

1. Blank or whitespace-only title is rejected while preserving form input (Task 2 test).
2. Invalid negative/NaN duration or out-of-range rating is rejected without changing a stored book (Task 3 test).
3. Deleting a book removes its notes and owned cover but no other book's records or cover (Task 5 and Task 6 tests).
4. Corrupt or unsupported backup leaves all existing data and covers intact (Task 7 test).
5. Duplicate titles and overlapping tag names are kept as distinct records and correct filter results (Task 4 test).

---

## File Map

- `app/_layout.tsx`, `app/index.tsx`, `app/book/new.tsx`, `app/book/[id].tsx`, `app/book/[id]/edit.tsx`, `app/settings.tsx`: routing and screen composition.
- `src/books/types.ts`, `validation.ts`, `repository.ts`, `sqliteRepository.ts`: domain shapes, input checking, persistence boundary and SQLite implementation.
- `src/books/BookForm.tsx`, `Bookshelf.tsx`, `BookDetail.tsx`, `Notes.tsx`: focused UI components.
- `src/covers/coverStore.ts`: import, read, delete owned image files.
- `src/backup/format.ts`, `backupService.ts`: versioned serialization, import validation, atomic replacement orchestration.
- `src/storage/database.ts`: schema migration and transactions; `src/storage/AppProvider.tsx`: dependency initialization.
- `tests/`: focused domain, repository, UI and backup tests beside these responsibilities; `README.md`: setup, use, backup warning and known limits.

Paths are relative to the new `novel-tracker` repository. The implementer may adjust Expo's generated entry files to fit its current stable template while retaining the listed module responsibilities and interfaces.

### Task 1: Project and first persistent slice

**Files:** Create Expo project and the approved spec path, `src/books/types.ts`, `src/books/repository.ts`, `src/books/sqliteRepository.ts`, `src/storage/database.ts`, `src/storage/AppProvider.tsx`, `app/_layout.tsx`, `app/index.tsx`, `app/book/new.tsx`, `tests/books/sqliteRepository.test.ts`, `README.md`.

**Interfaces:** `Book { id: string; title: string; status: BookStatus; createdAt: string; updatedAt: string; ...optional fields }`; `BookRepository.create(input: BookInput): Promise<Book>`, `list(): Promise<Book[]>`, `get(id: string): Promise<Book | null>`; `openDatabase(): Promise<SQLiteDatabase>` initializes schema version 1. IDs are generated on creation, timestamps use ISO 8601 UTC.

- [ ] **Step 1: Check the iPhone development path.** Confirm user's iOS version and App Store Expo Go version; check its supported SDK and same-account connection. Create a disposable probe that can open SQLite and invoke the image picker, document picker and share sheet on the actual device. Record results; choose and pin a compatible SDK before scaffolding the lasting project. If a required API cannot work in Expo Go, revise the zero-cost device test route with the user before relying on it.
- [ ] **Step 2: Write failing repository test.** With a test SQLite adapter/mocked native module, `create({ title: '长夜', status: 'want_to_read' })` then `list()` returns the same ID/title/status; two same-title records retain distinct IDs. Actual disk persistence is verified on iPhone in Step 5.
- [ ] **Step 3: Run the focused test.** `npm test -- --runInBand tests/books/sqliteRepository.test.ts`; expect failure before implementation.
- [ ] **Step 4: Scaffold and implement the slice.** Initialize the verified TypeScript Expo project; install SQLite and Jest support; define the interface and schema; wire a minimal bookshelf and add screen with title input. Copy approved spec into repository docs. Keep generated dependency lockfile.
- [ ] **Step 5: Verify.** Focused test, `npx tsc --noEmit`, `npx expo start`; ask the user to add a book on iPhone and reopen the project, then report the result. Document that clearing Expo Go data removes unexported records.
- [ ] **Step 6: Commit.** `git add . && git commit -m "feat: persist first novel record"`.

### Task 2: Book input and editing

**Files:** Create `src/books/validation.ts`, `src/books/BookForm.tsx`, `app/book/[id]/edit.tsx`, `tests/books/validation.test.ts`, `tests/books/BookForm.test.tsx`; modify domain types, repository and schema migration if required.

**Interfaces:** `validateBookInput(input: BookInput): ValidationResult<BookInput>`; `BookRepository.update(id: string, patch: BookPatch): Promise<Book>`; required title trimmed; optional author, platform, recommendation source/reason, dates, review, rating and duration; status enum as in Global Constraints.

- [ ] **Step 1: Write failing tests.** Whitespace title returns field error and form retains input; editing a saved book changes author/status/recommendation reason while preserving its ID and untouched fields.
- [ ] **Step 2: Run focused tests; expect failure.** `npm test -- --runInBand tests/books/validation.test.ts tests/books/BookForm.test.tsx`.
- [ ] **Step 3: Implement validated create/edit form and repository update.** Add state selection and optional fields, date picker/input appropriate to current Expo SDK. Leave a blank optional value as null, not an invented date.
- [ ] **Step 4: Verify focused tests and `npx tsc --noEmit`; inspect create/edit on iPhone.**
- [ ] **Step 5: Commit.** `git add . && git commit -m "feat: edit novel details"`.

### Task 3: Dates, rating, hours, and reviews

**Files:** Modify `src/books/validation.ts`, `src/books/BookForm.tsx`, `app/book/[id].tsx`; create `src/books/BookDetail.tsx`, `tests/books/bookFields.test.ts`, `tests/books/BookDetail.test.tsx`.

**Interfaces:** `parseDurationHours(text: string): number | null | FieldError`; `parseRating(value: unknown): 1 | 2 | 3 | 4 | 5 | null | FieldError`; date fields store `YYYY-MM-DD`, hours store numeric hours; review is one optional text field per book.

- [ ] **Step 1: Write failing tests.** Valid start/end dates, 2.5 hours, 5-star rating and review survive save/reload; negative/NaN duration, rating 0/6 and end date before start date show errors without changing the stored book.
- [ ] **Step 2: Run focused tests; expect failure.** `npm test -- --runInBand tests/books/bookFields.test.ts tests/books/BookDetail.test.tsx`.
- [ ] **Step 3: Implement parsing, validation and detail display.** Dates stay user-editable; status does not auto-populate or erase dates or review.
- [ ] **Step 4: Run tests and type check; verify real date and decimal-hour entry on iPhone.**
- [ ] **Step 5: Commit.** `git add . && git commit -m "feat: record reading dates hours and review"`.

### Task 4: Tags, search, and bookshelf

**Files:** Create `src/books/Bookshelf.tsx`, `src/books/filters.ts`, `tests/books/filters.test.ts`, `tests/books/Bookshelf.test.tsx`; modify schema, repository, form and `app/index.tsx`.

**Interfaces:** `BookRepository.setTags(bookId: string, names: string[]): Promise<void>`; `filterBooks(books: Book[], query: string, status: BookStatus | null, tags: string[]): Book[]`; tags are normalized for empty/duplicate values within a book, while display spelling is preserved. Search title/author case-insensitively; selected tags use AND semantics.

- [ ] **Step 1: Write failing tests.** Two books with same title remain separate; multiple tags persist; `['悬疑','群像']` returns books with both; query matches title or author; empty and no-result states display helpful text.
- [ ] **Step 2: Run focused tests; expect failure.** `npm test -- --runInBand tests/books/filters.test.ts tests/books/Bookshelf.test.tsx`.
- [ ] **Step 3: Implement tag schema, form chips, filter logic and status counts.** Default order by latest update descending with stable ID tie-break.
- [ ] **Step 4: Run tests/type check and try search/filter/clear filters on iPhone.**
- [ ] **Step 5: Commit.** `git add . && git commit -m "feat: browse and filter novel shelf"`.

### Task 5: Notes and deletion

**Files:** Create `src/books/Notes.tsx`, `tests/books/notes.test.ts`, `tests/books/delete.test.ts`; modify repository, SQLite schema and `app/book/[id].tsx`.

**Interfaces:** `Note { id: string; bookId: string; text: string; thought: string | null; createdAt: string; updatedAt: string }`; `BookRepository.addNote(bookId, input): Promise<Note>`, `updateNote(id, patch): Promise<Note>`, `deleteNote(id): Promise<void>`, `listNotes(bookId): Promise<Note[]>`, `deleteBook(id): Promise<void>`.

- [ ] **Step 1: Write failing tests.** Multiple notes can be added/edited/deleted independently; whitespace-only note text is rejected; deleting one book cascades only its notes, preserves another book and requires UI confirmation.
- [ ] **Step 2: Run focused tests; expect failure.** `npm test -- --runInBand tests/books/notes.test.ts tests/books/delete.test.ts`.
- [ ] **Step 3: Implement note persistence and UI, transactional book deletion.** Include accessible labels and cancellation path.
- [ ] **Step 4: Run tests/type check and exercise delete/cancel on iPhone.**
- [ ] **Step 5: Commit.** `git add . && git commit -m "feat: save notes and safely delete novels"`.

### Task 6: Local cover images

**Files:** Create `src/covers/coverStore.ts`, `tests/covers/coverStore.test.ts`; modify form, bookshelf, detail, repository delete flow and README.

**Interfaces:** `CoverStore.importFromPicker(uri: string, bookId: string): Promise<string>` returns owned relative path; `readUri(relativePath: string): string`; `delete(relativePath: string): Promise<void>`. Picker cancellation keeps existing cover; replacement deletes old owned file only after new file succeeds.

- [ ] **Step 1: Write failing tests.** Chosen image is copied to owned storage; picker cancellation changes nothing; replacement and book deletion remove only the corresponding owned file; default cover renders for null or missing path.
- [ ] **Step 2: Run focused test; expect failure.** `npm test -- --runInBand tests/covers/coverStore.test.ts`.
- [ ] **Step 3: Implement image picker, bounded image handling and file lifecycle.** Avoid storing a temporary picker URI as permanent data.
- [ ] **Step 4: Run tests/type check and verify picker permission, cancel and restart on iPhone.**
- [ ] **Step 5: Commit.** `git add . && git commit -m "feat: attach local novel covers"`.

### Task 7: Complete export and safe restore

**Files:** Create `src/backup/format.ts`, `src/backup/backupService.ts`, `tests/backup/format.test.ts`, `tests/backup/restore.test.ts`, `app/settings.tsx`; modify repository, database transaction support and README.

**Interfaces:** `BackupV1 { format: 'novel-tracker-backup'; version: 1; exportedAt: string; books: Book[]; notes: Note[]; covers: Record<string, string> }` where image values are base64 of owned files; `createBackup(repo, covers): Promise<BackupV1>`; `validateBackup(raw: unknown): BackupV1`; `restoreBackup(validated: BackupV1, repo, covers): Promise<void>`.

- [ ] **Step 1: Write failing tests.** Export/import round trip preserves IDs, all fields, multiple tags/notes and actual image bytes; malformed JSON, unsupported version, missing note parent, invalid base64, overly large file and missing cover fail before replacement, leaving old data/files intact. Inject a failure during replacement and assert that prior DB rows and cover files are recovered.
- [ ] **Step 2: Run focused tests; expect failure.** `npm test -- --runInBand tests/backup/format.test.ts tests/backup/restore.test.ts`.
- [ ] **Step 3: Implement versioned serialization and limits.** Define and test practical cover/backup limits with a sample library on iPhone; document them and show specific errors. Validate all input and stage image files before DB replacement; retain old DB data and cover files until the new data is fully committed, and restore both after any failure. Do not claim a cross-database/file transaction is atomic without testing it on the target runtime.
- [ ] **Step 4: Wire iOS share sheet and document picker.** Preview counts and require explicit replace confirmation; picker cancellation is a no-op. Document that imported backup is not merge.
- [ ] **Step 5: Verify tests/type check and have the user perform a real iPhone round trip.** Export, add throwaway data, restore, confirm both content and cover; repeat with an invalid file and confirm existing data remain. Keep a copy outside Expo Go for the eventual standalone-app migration.
- [ ] **Step 6: Commit.** `git add . && git commit -m "feat: export and restore complete library"`.

### Task 8: Release readiness for the zero-cost phase

**Files:** Modify `README.md`, screen labels and copy; create `docs/qa-checklist.md`, `docs/known-limitations.md`; update tests only for concrete found defects.

**Interfaces:** No new product API. README gives Windows setup, install, Expo account sign-in, iPhone Expo Go test, backup procedure and warning about clearing Expo Go data.

- [ ] **Step 1: Guide the user through all spec acceptance scenarios on iPhone.** Record OS, device, reproduction and actual result for defects; test empty shelf, duplicate title, multiple tags, offline reopen, permissions, backup round trip, delete confirmation and invalid import.
- [ ] **Step 2: Fix observed defects with a failing regression test for each meaningful logic bug.** Avoid tests that merely mirror static layout.
- [ ] **Step 3: Run `npm test -- --runInBand`, `npx tsc --noEmit`, and the project's lint command.** All exit 0; rerun only failed checks after repairs.
- [ ] **Step 4: Write setup and release notes.** State that Expo Go is a development preview, not a standalone App Store build; document future screenshot recognition, external record import, preference recommendations and cloud sync as separately scoped features.
- [ ] **Step 5: Commit.** `git add . && git commit -m "docs: prepare zero-cost iPhone pilot"`.

## Execution Handoff

Execute tasks in order. After Tasks 1, 4, 6 and 8, provide the user a short working demo and ask for product feedback, while continuing routine tests and fixes. Do not start App Store submission or register paid accounts under this plan. Future features in spec Section 8 each need their own design and implementation plan after sample data, privacy and cost decisions are known.
