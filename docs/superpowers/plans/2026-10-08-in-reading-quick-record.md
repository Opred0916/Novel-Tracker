# 在读快捷记录 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the spec first.

**Goal / 目标：** 让用户只在“在读”书架中直接为一本小说写想法、标记读完或标记弃读，并继续使用现有摘记、图片、阅读历史和评分数据。

**Architecture / 架构：** 为书籍仓储增加带“当前状态必须仍为在读”前置条件的原子结束阅读接口；扩展现有摘记表单，使其既能在详情页独立显示，也能嵌入快捷面板。新建一个只负责加载当前书籍、切换三种子流程和关闭保护的 `QuickRecordSheet`，书架只负责决定入口是否出现以及成功后的搜索与数量刷新。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native 0.86、TypeScript、Expo SQLite、React Native Community DateTimePicker／Slider、Jest、Testing Library；不新增依赖。Windows PowerShell 使用 `npm.cmd`／`npx.cmd`。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-08-in-reading-quick-record-design.md`

## Global Constraints / 全局约束

- 快捷入口只在当前一级分区为“在读”且未进入批量整理时出现；“全部”和其他状态分区不出现。
- 书卡主体仍进入详情，快捷按钮必须独立响应，不能同时触发详情跳转。
- “写想法”“标记读完”“标记弃读”分别提交；摘记不是结束阅读的必填项。
- 写想法继续要求去除首尾空白后非空，图片选填，并复用现有精彩片段／相册规则和自动阅读次数关联。
- 读完使用当前阅读开始日期、默认当天结束日期和可选半星评分；弃读不显示评分，也不清除已有评分。
- 结束阅读提交必须在数据库事务中确认书籍仍为 `reading`；过期面板不能创建新的结束记录。
- 不新增数据库表、不修改备份版本、不改变搜索、导入、导出或年度统计口径。
- 使用当前主题色、iPhone 安全区和键盘避让；未在 iPhone 真机验证前，不声称键盘与底部面板体验已经验收。
- 遵循用户的测试偏好：每项运行相关定向测试；收尾只运行一次组合回归、TypeScript、lint 和 `git diff --check`。

## Review Focus

- 书籍在面板打开后被其他操作改为读完、弃读或想读：提交应提示状态已变化，不能再造一条阅读记录；任务 1、3 测试。
- 旧数据中书籍状态为在读但缺少活动阅读记录：结束时使用用户确认的开始／结束日期补成一条记录，不能崩溃或静默丢失；任务 1、3 测试。
- 快速双击保存、读完或弃读：只执行一次仓储调用，按钮在提交期间禁用；任务 2、3 测试。
- 用户写了文字或修改了日期后通过遮罩、关闭按钮或系统返回离开：都必须走同一放弃确认；任务 2、3 测试。
- 相册取消、图片复制失败、仓储保存失败和书架刷新失败：保留输入或以已提交数据为准，不能显示虚假成功；任务 2、4 测试。

---

## 文件分工

- 修改 `src/books/types.ts`、`src/books/repository.ts`、`src/books/sqliteRepository.ts`：定义并实现带状态前置条件的原子结束阅读操作。
- 修改 `src/books/NoteForm.tsx`、`src/ui/BottomSheet.tsx`：支持嵌入式摘记、自动聚焦、脏状态上报、提交禁用和键盘避让；详情页现有行为保持不变。
- 新建 `src/books/QuickRecordSheet.tsx`：加载当前书籍、活动阅读记录和精彩片段，管理菜单／想法／读完／弃读四种视图。
- 修改 `src/books/BookCard.tsx`、`src/books/BookshelfScreen.tsx`：仅在“在读”分区接入快捷按钮，并在成功后刷新搜索结果与状态数量。
- 新建 `tests/books/QuickRecordSheet.test.tsx`；修改 `tests/books/BookCard.test.tsx`、`tests/books/NoteForm.test.tsx`、`tests/books/readingTransitions.test.ts`、`tests/books/bookRoutes.test.tsx`、`tests/ui/BottomSheet.test.tsx`。
- 实现完成后更新 `README.md` 的使用说明，不提前把未实现功能写成已完成。

### Task 1：原子结束当前阅读

**Files:**

- Modify: `src/books/types.ts`
- Modify: `src/books/repository.ts`
- Modify: `src/books/sqliteRepository.ts`
- Modify: `src/books/validation.ts`
- Modify: `tests/books/readingTransitions.test.ts`

**Interfaces:**

```ts
export type EndReadingInput =
  | { outcome: 'finished'; startedOn: string; endedOn: string; ratingHalfStars: number | null }
  | { outcome: 'dropped'; startedOn: string; endedOn: string };

export interface BookRepository {
  endReading(id: string, input: EndReadingInput): Promise<Book>;
}

export function normalizeRatingHalfStars(value: unknown): number | null;
```

- [ ] **Step 1: Write failing transition tests.** Add `ends_current_reading_as_finished_with_confirmed_dates_and_rating` and `ends_current_reading_as_dropped_without_clearing_rating`; assert the active session is updated in place, book status changes, finished rating uses the submitted half-stars, and dropped preserves the existing rating.
- [ ] **Step 2: Add stale and legacy tests.** Add `rejects_end_when_book_is_no_longer_reading`, asserting no extra session is inserted after another update changes the status; add `ends_legacy_reading_without_an_active_session`, asserting a status-only old row receives exactly one completed session from the submitted dates.
- [ ] **Step 3: Add validation and rollback tests.** Assert invalid calendar dates, end-before-start, invalid rating, missing book, and an injected session update failure leave both book and session unchanged.
- [ ] **Step 4: Run red.** Run `npm.cmd test -- --runInBand tests/books/readingTransitions.test.ts`; expected FAIL because `endReading` and the exported rating normalizer do not exist.
- [ ] **Step 5: Implement the domain operation.** Export the existing half-star normalizer. In `SqliteBookRepository.endReading`, normalize dates and the finished rating before opening one exclusive transaction; read the current book row, require `status === 'reading'`, reuse `applyStatusTransition`, then update only `books.status`, the finished rating when applicable, and `updated_at`. Dropped must retain the stored rating. Return `get(id)` after commit.
- [ ] **Step 6: Run green and commit.** Re-run Task 1 tests, then commit `feat: safely finish active reading`.

### Task 2：可嵌入的摘记表单与安全关闭

**Files:**

- Modify: `src/books/NoteForm.tsx`
- Modify: `src/books/NotesSection.tsx`
- Modify: `src/ui/BottomSheet.tsx`
- Modify: `tests/books/NoteForm.test.tsx`
- Modify: `tests/books/NotesSection.test.tsx`
- Modify: `tests/ui/BottomSheet.test.tsx`

**Interfaces:**

```ts
export type NoteFormRepository = Pick<SqliteNotesRepository,
  'createNote' | 'updateNote' | 'registerImage' | 'addHighlights'>;

type NoteFormProps = {
  bookId: string;
  note?: Note;
  highlights: ImageAsset[];
  repository: NoteFormRepository;
  onSaved(): void;
  onCancel(): void;
  embedded?: boolean;
  autoFocus?: boolean;
  onDirtyChange?(dirty: boolean): void;
};
```

`BottomSheet` 保留现有 props；其内部滚动区域增加 iOS 键盘自动避让，不改变筛选、排序和更多面板的调用方式。

- [ ] **Step 1: Write failing form tests.** Assert `embedded` hides the duplicate page title／outer padding, `autoFocus` reaches the multiline input, changing text or image selection reports dirty, successful save reports clean, and a second press while saving does not call `createNote` twice.
- [ ] **Step 2: Add failure-preservation tests.** Assert blank text still shows“请输入我的想法”; rejected `createNote`, image picker cancellation and rejected image registration leave the typed body rendered and allow retry.
- [ ] **Step 3: Add bottom-sheet keyboard regression.** Assert its `ScrollView` uses `keyboardShouldPersistTaps="handled"` and `automaticallyAdjustKeyboardInsets`, while close button、遮罩和系统返回 still call the same `onClose` callback.
- [ ] **Step 4: Run red.** Run `npm.cmd test -- --runInBand tests/books/NoteForm.test.tsx tests/books/NotesSection.test.tsx tests/ui/BottomSheet.test.tsx`; expected FAIL on the new props, dirty reporting and submit guard.
- [ ] **Step 5: Refactor without duplicating behavior.** Keep one NoteForm state and save path; render the same field content inside a `View` for embedded mode and the existing scroll container otherwise. Add `saving` with `finally`, catch album-copy／registration failures into the existing error area, and emit dirty changes from body／image differences. `NotesSection` continues using the default non-embedded mode.
- [ ] **Step 6: Run green and commit.** Re-run Task 2 tests, then commit `refactor: reuse note form in quick records`.

### Task 3：快捷记录底部面板

**Files:**

- Create: `src/books/QuickRecordSheet.tsx`
- Create: `tests/books/QuickRecordSheet.test.tsx`
- Reuse: `src/ui/BottomSheet.tsx`
- Reuse: `src/books/NoteForm.tsx`
- Reuse: `src/books/ReadingDateFields.tsx`
- Reuse: `src/books/RatingField.tsx`

**Interfaces:**

```ts
export type QuickRecordResult = 'note_saved' | 'finished' | 'dropped';

export function QuickRecordSheet(props: {
  visible: boolean;
  bookId: string | null;
  books: Pick<BookRepository, 'get' | 'endReading'>;
  history: Pick<SqliteReadingHistoryRepository, 'list'>;
  notes: NoteFormRepository & Pick<SqliteNotesRepository, 'listHighlights'>;
  onClose(): void;
  onChanged(result: QuickRecordResult): void;
}): React.ReactElement | null;
```

- [ ] **Step 1: Write failing menu and loading tests.** Opening loads the current book, sessions and highlights; menu shows cover、书名、作者 and exactly“写想法／标记读完／标记弃读”. Query failure shows retry, missing／non-reading book shows state-changed copy, and closing an untouched menu makes no write.
- [ ] **Step 2: Write failing note-flow tests.** Selecting“写想法”renders embedded NoteForm; saving calls `onChanged('note_saved')`, returns to the menu, briefly shows“想法已保存”and still offers the two status actions. Dirty close from button、backdrop or `onRequestClose` opens one“放弃未保存内容？”Alert; cancel keeps the sheet open and confirm closes it.
- [ ] **Step 3: Write failing finish/drop tests.** Finish defaults to the active session start and `todayLocalDate()`, displays RatingField with the book's current rating, then calls `endReading` with outcome `finished`. Drop uses the same dates, has no rating control and calls outcome `dropped`. If no active session exists, both start and end default to today.
- [ ] **Step 4: Add async safety tests.** A double confirmation calls `endReading` once; rejected saves retain draft values and show retryable error; changing `bookId` or closing before a load resolves prevents the old response from replacing current state.
- [ ] **Step 5: Run red.** Run `npm.cmd test -- --runInBand tests/books/QuickRecordSheet.test.tsx`; expected FAIL because the component does not exist.
- [ ] **Step 6: Implement the state machine.** Use modes `'menu' | 'note' | 'finished' | 'dropped'`; reset only when a new visible `bookId` opens. Load all three sources with a request token, derive the active session by `outcome === 'reading'`, and keep `dirty`／`saving` local. All close paths call one guarded close function.
- [ ] **Step 7: Implement status forms.** Reuse ReadingDateFields and RatingField; validate through `endReading`, do not duplicate calendar or rating rules in the component. On success call `onChanged` once and close; on error keep selections visible.
- [ ] **Step 8: Run green and commit.** Re-run Task 3 tests, then commit `feat: add in-reading quick record sheet`.

### Task 4：书卡入口与书架刷新

**Files:**

- Modify: `src/books/BookCard.tsx`
- Modify: `src/books/BookshelfScreen.tsx`
- Modify: `tests/books/BookCard.test.tsx`
- Modify: `tests/books/bookRoutes.test.tsx`

**Interfaces:**

```ts
export type BookCardProps = {
  book: Book;
  matchedNoteSnippet?: string | null;
  matchedImage?: BookSearchResult['matchedImage'];
  onPress(): void;
  selection?: { checked: boolean; onToggle(): void };
  onQuickRecord?: () => void;
};

export function BookCard(props: BookCardProps): React.ReactElement;
```

`BookshelfScreen` 新增 `quickRecordBookId: string | null` 状态，并把现有 `useBooks()`、`useReadingHistory()`、`useNotes()` 仓储传给 `QuickRecordSheet`。

- [ ] **Step 1: Write failing BookCard tests.** When `onQuickRecord` exists, render an accessible“快捷记录《书名》”button; pressing it calls only `onQuickRecord`, not the card `onPress`. Without the prop, card markup and rating remain unchanged. Selection mode suppresses the quick button.
- [ ] **Step 2: Write failing visibility tests.** In Bookshelf, no quick buttons appear for status `null`, `want_to_read`, `finished` or `dropped`; selecting the `reading` tab shows one button per result. Entering bulk mode hides them, and leaving bulk mode restores them.
- [ ] **Step 3: Write failing integration tests.** Pressing a quick button opens the matching sheet. After `note_saved`, call search `retry()` and keep the current status／query／type／tag／sort selections. After `finished` or `dropped`, also refresh the overview counts; the completed book disappears naturally from the reading result after the repository returns new search data.
- [ ] **Step 4: Add refresh-failure test.** If the write succeeds but overview refresh rejects, close the sheet, retry search, show the existing non-blocking count error and never call the write again.
- [ ] **Step 5: Run red.** Run `npm.cmd test -- --runInBand tests/books/BookCard.test.tsx tests/books/bookRoutes.test.tsx`; expected FAIL because the prop, visibility rule and sheet integration do not exist.
- [ ] **Step 6: Implement the card action.** Add the compact theme-aware text button and stop event propagation so it never opens detail. Preserve card accessibility and current selection behavior; do not change cards outside the reading tab.
- [ ] **Step 7: Wire the shelf.** Import `useReadingHistory`, `useNotes` and QuickRecordSheet; pass `onQuickRecord` only when `status === 'reading' && !bulkMode`. Centralize overview refresh so focus、bulk completion and quick status changes share the same error behavior. Quick-note success retries search but does not unnecessarily reset filters or navigate.
- [ ] **Step 8: Run green and commit.** Re-run Task 4 tests, then commit `feat: open quick records from reading shelf`.

### Task 5：组合回归、说明与真机交接

**Files:**

- Modify: `README.md`
- Modify only failing implementation／test files discovered by verification.

**Interfaces:** 不新增接口；本任务验证前四项组合后的行为。

- [ ] **Step 1: Run the focused regression once.** Run `npm.cmd test -- --runInBand tests/books/readingTransitions.test.ts tests/books/NoteForm.test.tsx tests/books/NotesSection.test.tsx tests/books/QuickRecordSheet.test.tsx tests/books/BookCard.test.tsx tests/books/bookRoutes.test.tsx tests/books/readingHistoryRepository.test.ts tests/books/annualSummaryRepository.test.ts tests/ui/BottomSheet.test.tsx`; expected all suites pass.
- [ ] **Step 2: Run static checks once.** Run `npx.cmd tsc --noEmit`, `npx.cmd expo lint --no-cache`, and `git diff --check`; expected zero errors.
- [ ] **Step 3: Review against the spec.** Confirm entry visibility, independent operations, stale-state rejection, legacy active-session fallback, image behavior, date/rating rules, refresh semantics, theme colors, keyboard scrolling and absence of schema／backup changes. Remove any feature not required by the spec.
- [ ] **Step 4: Update user documentation.** Add a concise README step explaining that the quick entry appears only after selecting“在读”, and that writing a thought is independent from finishing or dropping a book. Do not describe unverified iPhone behavior as passed.
- [ ] **Step 5: Commit final documentation or fixes.** Commit `docs: explain in-reading quick records` or a focused `fix:` commit if verification found an implementation defect. End with a clean worktree; do not merge or push without explicit user authorization.
- [ ] **Step 6: Hand off the minimal iPhone checklist.** Ask the user to verify only: reading-tab visibility、card/details tap separation、keyboard and safe-area behavior、text-only thought、album cancel、finish with half-star rating、drop preserving old rating、list/count refresh and closing a dirty form.
