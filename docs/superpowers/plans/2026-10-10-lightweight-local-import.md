# Lightweight Local Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make pasted lists, mixed social text, and screenshot OCR useful to import without silently inventing book data.

**Architecture:** A shared local segment-and-extract layer feeds the existing `ImportParseResult`. Candidates carry field-level uncertainty and source evidence; the existing review/commit layer requires explicit confirmation before uncertain values are written. The review UI becomes summary-first with optional detail editing.

**Tech Stack:** TypeScript, Expo/React Native, Jest and React Native Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-10-lightweight-local-import-design.md`

## Global Constraints

- Entirely on-device; no cloud recognition, large downloaded model, payment, or new native dependency.
- Preserve source text, source line, and screenshot source reference through parsing and editing.
- Never borrow a field from an adjacent book; uncertain content must be visible before commit.
- Keep existing import size/candidate limits, duplicate checks, and commit validation.
- Before touching Expo/React Native APIs, read the installed Expo major version and matching official docs per `AGENTS.md`.

## Review Focus

- A social nickname/date followed by a book must not become a title; pin in Task 2 mixed-text test.
- A note containing “作者：” or “评分：” must stay a note; pin in Task 2 note test.
- A score after an OCR-broken line must not attach to the next book; pin in Task 3 OCR test.
- An empty-confidence parse must still show its source for manual conversion; pin in Task 4 route test.
- Skipping a candidate must not require confirming its uncertain fields; pin in Task 1 validation test.

---

### Task 1: Field-level review state and commit safety

**Files:** Modify `src/import/importTypes.ts`, `src/import/importReview.ts`, `src/import/importReviewActions.ts`; test `tests/import/importReview.test.ts`, `tests/import/importReviewActions.test.ts`.

**Interfaces:** Add optional `fieldReview?: Partial<Record<'title' | 'author' | 'ratingHalfStars' | 'status' | 'notes', string>>` to `ImportCandidate`; add optional `confirmedFields?: string[]` to `ImportReviewItem` and an action `{ type: 'confirm_field'; candidateId: string; field: keyof NonNullable<ImportCandidate['fieldReview']> }`. `validateImportReview(review)` returns `unconfirmed_field` only for non-skipped items with unresolved marked fields. Existing candidates without `fieldReview` remain valid.

- [ ] Write failing tests: marked author blocks commit until confirmed; editing/confirming clears that issue; skipped candidate needs no confirmation; fragment and duplicate rules still apply.
- [ ] Run `npm test -- --runInBand tests/import/importReview.test.ts tests/import/importReviewActions.test.ts`; expect new tests to fail.
- [ ] Add the types, confirmation action, and validation with immutable review updates. Keep source evidence unchanged.
- [ ] Rerun focused tests; expect pass.
- [ ] Commit only Task 1 files with `feat: track uncertain import fields`.

### Task 2: Shared segmentation and cautious text extraction

**Files:** Create `src/import/localTextExtraction.ts`; modify `src/import/autoTextImport.ts` and, only where needed, `src/import/textImportParser.ts`; test `tests/import/autoTextImport.test.ts`, create `tests/import/localTextExtraction.test.ts`.

**Interfaces:** Export `extractLocalText(text: string, defaultStatus: BookStatus): ImportParseResult`. `parseAutoTextImport` delegates to it; explicit manual modes continue through `parseTextImport`. The extractor emits stable candidate/fragment IDs, source lines/text, and `fieldReview` reasons for plausible but ambiguous fields. Nonblank text with no book candidate returns fragments instead of throwing.

- [ ] Write failing tests for a tidy author/title/score list, numbered records, mixed nickname/date/UI text, note containing field-looking words, and ambiguous free text retained as a fragment. Assert no cross-book field assignment.
- [ ] Run `npm test -- --runInBand tests/import/autoTextImport.test.ts tests/import/localTextExtraction.test.ts`; expect failures.
- [ ] Implement local segmentation and conservative extraction. Reuse existing explicit-field and score rules where possible; do not copy the full legacy parser into the new file.
- [ ] Rerun focused tests; expect pass.
- [ ] Commit only Task 2 files with `feat: segment mixed local import text`.

### Task 3: Screenshot OCR into the same review contract

**Files:** Modify `src/import/screenshotImportParser.ts`; test `tests/import/screenshotImportParser.test.ts`.

**Interfaces:** Change `parseScreenshotImport(pages, mode: ImportMode | null, defaultStatus): ImportParseResult` and pass the existing `mode` state from `src/app/settings/import.tsx` (null means auto). Preserve `sourceRef`, source text and page ordering. In auto mode use the Task 2 extraction contract per page, and flag OCR-ambiguous fields rather than silently asserting them; explicit modes retain their documented behavior.

- [ ] Write failing tests for multiple pages, OCR line breaks between books and scores, broken glyphs, and missing title. Assert source page/line and no score leakage.
- [ ] Run `npm test -- --runInBand tests/import/screenshotImportParser.test.ts`; expect failures.
- [ ] Adapt screenshot auto parsing to the shared extractor while retaining screenshot-specific page/continuation handling.
- [ ] Rerun focused tests; expect pass.
- [ ] Commit only Task 3 files with `feat: review uncertain screenshot extraction`.

### Task 4: Summary-first review and fast triage

**Files:** Modify `src/import/ImportReviewList.tsx`, `src/import/ImportSourceForm.tsx`, `src/app/settings/import.tsx`; test `tests/import/importReviewList.test.tsx`, `tests/import/importPage.test.tsx`.

**Interfaces:** Keep `ImportReviewList` props unchanged. Default card shows title, author, score, source and uncertainty; tapping “更多资料” expands existing fields. Top bar shows candidate/unresolved counts and a “只看待确认” filter. Fragment actions remain book/note/ignore and expose original text. Confirm action uses Task 1 validation.

- [ ] Write failing UI tests for collapsed cards, expand/edit, confirm-field control, unresolved filter, fragment triage, keyboard-reachable controls, and empty extraction entering review with source intact.
- [ ] Run `npm test -- --runInBand tests/import/importReviewList.test.tsx tests/import/importPage.test.tsx`; expect failures.
- [ ] Implement the summary-first presentation and route handling; preserve existing duplicate and commit controls. Consult matching Expo docs before any API change.
- [ ] Rerun focused tests; expect pass.
- [ ] Commit only Task 4 files with `feat: streamline local import review`.

### Task 5: End-to-end regression and cleanup

**Files:** Add representative fixtures under `tests/import/fixtures/`; modify import tests as required by real regressions, not to weaken assertions.

**Interfaces:** No new production API. Check parsed fields, uncertainty, provenance, user decisions and final validation across text, screenshot and table paths.

- [ ] Add fixture-driven tests for tidy list, mixed chat, OCR noise and table mapping; include invalid rating and duplicate title cases.
- [ ] Run new fixture tests first; fix only demonstrated regressions in owning modules.
- [ ] Run `npm test -- --runInBand`, `npx.cmd tsc --noEmit`, `npx.cmd expo lint`, and `git diff --check`; require green results before completion claim.
- [ ] Review the branch diff for source loss, false certainty, and regressions. Commit fixture/regression changes only.

## Execution note

This workspace currently has uncommitted import changes from the previous iteration. Preserve them. At execution start, inspect the diff and either incorporate them into the owning tasks or isolate the new work without resetting or overwriting them. Do not include unrelated changes in task commits.
