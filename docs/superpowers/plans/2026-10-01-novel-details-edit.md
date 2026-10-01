# Novel Details and Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user open a saved novel and safely edit its title, author, reading status, and any number of protagonist names.

**Architecture:** Extend the existing SQLite repository with a nullable author column and an ordered protagonist child table. Keep the title-only creation path, add focused detail/edit components, then connect them through Expo Router. All updates to a book and its protagonist rows happen in one exclusive transaction.

**Tech Stack:** Expo SDK 57, Expo Router, React Native, TypeScript, `expo-sqlite`, Jest, React Native Testing Library, Node `node:sqlite` for repository tests. No new package is required.

**Spec:** `docs/superpowers/specs/2026-10-01-novel-details-edit-design.md`

## Global Constraints

- Preserve all existing book IDs, titles, statuses, creation times, and on-device rows during migration.
- Four statuses remain `want_to_read`, `reading`, `finished`, and `dropped`.
- Title is required; author and protagonists are optional. Show two protagonist inputs by default but store only nonblank names, in order.
- Keep quick add as a title-only flow. Do not add reread records or other V1 features in this plan.
- Target Windows development and iPhone Expo Go; use `npx.cmd` in PowerShell because `npx.ps1` is blocked on this machine.
- Match the existing `src/app/` Expo Router layout and repository boundary. Check [SDK 57 SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/) before changing native APIs; its exclusive transaction callback uses the transaction object and is not supported on web.
- The GitHub Desktop checkout initially has no `node_modules`; run `npm.cmd ci` from its root before tests. Do not commit `node_modules`.

## Review Focus

1. A pre-update database has `books` but `user_version = 0`: migration adds fields without replacing rows; Task 1 tests this and a second migration run.
2. Input has blank or whitespace-only title: save is rejected, old data stays and the form retains its text; Tasks 2 and 3 test this.
3. Protagonist inputs contain zero, one, two, three-plus names, blanks, or punctuation: only nonblank trimmed names persist in the same order; Tasks 2 and 3 test this.
4. A write fails after the book row changes but before protagonist replacement completes: the whole edit rolls back; Task 2 injects a failure and checks both tables.
5. A detail/edit route receives an unknown ID or the database read fails: show an error/return path without a crash or false success; Task 4 tests this.

---

## File Map

- `src/storage/database.ts`: idempotent schema upgrade, author column, ordered child table, foreign keys, transaction-capable database type.
- `tests/helpers/inMemoryDatabase.ts`: `node:sqlite` adapter with real rollback semantics for repository tests.
- `src/books/types.ts`, `src/books/validation.ts`, `src/books/status.ts`: expanded `Book`, full `BookEditInput`, trimming/validation and shared Chinese status labels.
- `src/books/repository.ts`, `src/books/sqliteRepository.ts`: atomic update and loading author/protagonists.
- `src/books/BookEditForm.tsx`, `src/books/BookDetail.tsx`, `src/books/BookCard.tsx`: focused form, detail display, and clickable shelf card.
- `src/app/index.tsx`, `src/app/book/[id].tsx`, `src/app/book/[id]/edit.tsx`, `src/app/_layout.tsx`: route wiring and fresh reads on focus.
- `tests/books/`: migration, repository, form, and route/card tests. `README.md`: new workflow and on-device verification note.

### Task 1: Upgrade SQLite without losing books

**Files:** Modify `src/storage/database.ts`; create `tests/helpers/inMemoryDatabase.ts`, `tests/books/migration.test.ts`; adjust `tests/books/sqliteRepository.test.ts` to use the shared adapter.

**Interfaces:** `migrateDatabase(db: Database): Promise<void>` stays public. `Database` adds `withExclusiveTransactionAsync`. `createInMemoryDatabase(): Database & { close(): void }` exposes a real SQLite-backed adapter. Schema adds `books.author TEXT NULL` and `book_protagonists(book_id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY(book_id, position), FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE)`.

- [ ] **Step 1: Install locked dependencies.** Run `npm.cmd ci` in this checkout; expect exit 0 and keep `node_modules` ignored.
- [ ] **Step 2: Write failing migration tests.** Create a V1 `books` table and row with `user_version = 0`; after migration assert the same ID/title/status/timestamps, nullable author, empty protagonist table, `user_version = 2`, and successful second migration. Also assert a fresh database gets both tables.
- [ ] **Step 3: Run the focused tests and confirm failure.** `npm.cmd test -- --runInBand tests/books/migration.test.ts`; expected failure is missing V2 schema/version.
- [ ] **Step 4: Implement the migration and test adapter.** Detect whether `books` and its author column already exist before `ALTER TABLE`; create the child table if absent, enable foreign keys, set version only after successful migration. Make the adapter's exclusive transaction use real `BEGIN`/`COMMIT`/`ROLLBACK` and pass the transaction adapter to the callback.
- [ ] **Step 5: Rerun migration and existing repository tests.** `npm.cmd test -- --runInBand tests/books/migration.test.ts tests/books/sqliteRepository.test.ts`; both pass. Run `npx.cmd tsc --noEmit`.
- [ ] **Step 6: Commit.** Stage only Task 1 files; commit `feat: migrate novel details schema`.

### Task 2: Validate and atomically persist edited details

**Files:** Modify `src/books/types.ts`, `src/books/repository.ts`, `src/books/sqliteRepository.ts`; create `src/books/validation.ts`, `tests/books/editBook.test.ts`.

**Interfaces:** `Book` adds `author: string | null` and `protagonists: string[]`; `BookInput` remains title/status for quick add. `BookEditInput = Pick<Book, 'title' | 'author' | 'status' | 'protagonists'>`. `normalizeBookEdit(input: BookEditInput): BookEditInput` trims title/author/names, converts blank author to `null`, drops blank names, and throws on blank title or invalid status. `BookRepository.update(id: string, input: BookEditInput): Promise<Book>` throws for missing ID, retains ID/`createdAt`, updates `updatedAt`.

- [ ] **Step 1: Write failing tests.** Assert `create` returns `author: null` and `protagonists: []`; `update` and a fresh `get`/`list` retain edited title, author, status and `[' 阿青 ', '', '李,四', ' 王五 ']` as `['阿青', '李,四', '王五']`. Assert blank title and invalid runtime status reject without changing stored rows. Assert missing ID rejects. Add a SQLite `BEFORE INSERT` trigger that aborts a protagonist insert, then assert the book row and prior protagonists remain unchanged.
- [ ] **Step 2: Run and confirm failure.** `npm.cmd test -- --runInBand tests/books/editBook.test.ts`; expected failures are missing update/fields/validation.
- [ ] **Step 3: Implement domain and repository.** Parameterize all SQL values. Load protagonist rows ordered by `position` for `get` and `list`. For update, use `withExclusiveTransactionAsync(async txn => ...)` and run every book/protagonist write on `txn`, then read the committed book. Do not change the title-only add form.
- [ ] **Step 4: Verify.** Rerun `tests/books/editBook.test.ts` and `tests/books/sqliteRepository.test.ts`, then `npx.cmd tsc --noEmit`; all pass.
- [ ] **Step 5: Commit.** Stage only Task 2 files; commit `feat: persist editable novel details`.

### Task 3: Build the detail display and edit form

**Files:** Create `src/books/status.ts`, `src/books/BookEditForm.tsx`, `src/books/BookDetail.tsx`, `tests/books/BookEditForm.test.tsx`, `tests/books/BookDetail.test.tsx`.

**Interfaces:** `BookEditForm({ book, onSave }: { book: Book; onSave: (input: BookEditInput) => Promise<void> })`; `BookDetail({ book }: { book: Book })`; `BOOK_STATUS_LABELS: Record<BookStatus, string>` maps the four statuses to 想读/在读/读完/弃读. The edit form preloads existing values, shows `Math.max(2, book.protagonists.length)` protagonist inputs, appends another input on “＋ 添加主角”, and has a manual save button. Error messages are local to the form; the caller navigates only after `onSave` succeeds.

- [ ] **Step 1: Write failing component tests.** Assert two initial empty inputs for a book with no protagonists; all existing names display when there are three; adding a third field and saving sends ordered names; empty book title shows an error without calling `onSave`; a rejected `onSave` keeps typed values and allows retry. Assert detail displays author, status label and names in order, with an empty-state label when optional values are absent.
- [ ] **Step 2: Run and confirm failure.** `npm.cmd test -- --runInBand tests/books/BookEditForm.test.tsx tests/books/BookDetail.test.tsx`; expected failure is absent components.
- [ ] **Step 3: Implement the components.** Use existing React Native style conventions, clear labels/accessibility for every name input, disable duplicate save taps while saving, and display all four status choices. Reuse `normalizeBookEdit` for the actual save payload.
- [ ] **Step 4: Verify.** Rerun focused tests and `npx.cmd tsc --noEmit`; all pass.
- [ ] **Step 5: Commit.** Stage only Task 3 files; commit `feat: add novel detail and edit components`.

### Task 4: Connect the shelf, detail and edit routes

**Files:** Create `src/books/BookCard.tsx`, `src/app/book/[id].tsx`, `src/app/book/[id]/edit.tsx`, `tests/books/bookRoutes.test.tsx`; modify `src/app/index.tsx`, `src/app/_layout.tsx`, `README.md`.

**Interfaces:** `BookCard({ book, onPress }: { book: Book; onPress: () => void })` renders the real status. Detail and edit routes read `id` with `useLocalSearchParams`, load from `useBooks().get(id)` on focus, render loading/error/not-found states, and link to each other. Edit route calls `repo.update(id, input)` and navigates back only on success. The bookshelf reloads on focus as it already does.

- [ ] **Step 1: Write failing route/card tests.** Pressing a book card invokes navigation and renders its actual status. Mock `useBooks` and route params to assert detail fetch/display, edit prefill and `update` call, unknown ID with return link, and read failure with a retry/error path.
- [ ] **Step 2: Run and confirm failure.** `npm.cmd test -- --runInBand tests/books/bookRoutes.test.tsx`; expected failure is absent route/card behavior.
- [ ] **Step 3: Implement routes and shelf wiring.** Register both routes in `Stack`, use parameterized local navigation, keep the add flow unchanged, and update `README.md` with the new edit path and device test steps.
- [ ] **Step 4: Run full automated checks.** `npm.cmd test -- --runInBand`, `npx.cmd tsc --noEmit`, `npx.cmd expo lint`; all exit 0. Run `npx.cmd expo-doctor` and record any diagnostic; avoid calling it a pass unless it actually passes.
- [ ] **Step 5: Request iPhone acceptance.** Start Expo from this GitHub checkout in LAN mode; ask the user to open an existing first-version novel, add three protagonists, change status, close/reopen the project, and report whether all values and old books remain. Only mark phone verification complete after their report.
- [ ] **Step 6: Commit.** After automated checks and in-scope fixes, stage only Task 4 files; commit `feat: navigate and edit novels`.

## Execution Handoff

Tasks run in order with a test/commit checkpoint after each. Do not push to GitHub or begin reread-record work automatically; report the finished local commits and let the user decide when to push. If physical-device verification is not available during execution, mark it pending rather than claiming success.
