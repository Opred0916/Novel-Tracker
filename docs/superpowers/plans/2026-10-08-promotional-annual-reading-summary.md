# 推广型年度阅读总结 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the spec first.

**Goal / 目标：** 在现有年度回顾之上增加一套按年份生成的全屏阅读故事和可保存、可分享的年度海报，准确呈现读完书目、月份轨迹、阅读偏好、评分、想法、精彩片段和条件式重读彩蛋。

**Architecture / 架构：** 新建独立只读年度总结仓储，从现有 SQLite 数据生成一份统一 `AnnualStorySummary`；纯函数把它编排为动态故事页面，React Native 分页组件只负责展示与导航。最终海报从同一份总结创建不可变快照，保存和分享复用现有回顾图片平台层，不增加数据库表或原生依赖。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native 0.86、TypeScript、Expo SQLite、React Native View Shot、Expo Media Library、Expo Sharing、Jest；项目使用 npm 锁文件，Windows PowerShell 命令使用 `npm.cmd`／`npx.cmd`。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-08-promotional-annual-reading-summary-design.md`

## Global Constraints / 全局约束

- 只在设备本地查询、编排和生成图片；不调用 AI、不上传书库、不自动发布、不记录分享目标。
- 核心数字只显示“今年读完 X 本小说”；同书同年多次完成按 `book_id` 去重，`completedReadingCount` 不进入新故事主线。
- 年度和月份只接受有效 `finished.ended_on`；`legacy_read_count`、当前状态、创建时间和导入时间不能补造完成日期。
- 月份轨迹中每本书只归入该年最早一次有效完成月份，确保十二个月总数等于年度不同书数。
- 标签、作品类型、作者、评分和精彩片段使用“当前保存”口径；想法按现有 App 本地日期／导入原始日期规则归年。
- 精彩片段无可靠原始收藏日期，文案固定使用“当年读完的这些书，目前共保存”；不能声称它们收藏于该年。
- 页面按资格动态省略，不显示 0 次重读、空偏好、空评分或占位页面；最终进度数来自实际页面数组。
- 海报默认不含摘记正文、截图、OCR 文字、弃读书、首发平台、设备信息或数据库 ID；隐私开关只影响当前预览。
- 复用现有 `recapSharePlatform.ts` 的截图、相册、系统分享和临时文件清理；不安装新依赖、不创建年度统计表、不做数据库迁移。
- 开发中运行相关定向测试；收尾执行年度总结相关回归、TypeScript、lint 和 `git diff --check`。iPhone 未实测不得标为通过。

## Review Focus

- 同一本书在同年跨月份读完多次：年度书数和月份柱形只计一次，但重读彩蛋仍出现；任务 1、2 的测试覆盖。
- 同日多本、标签／作者／评分完全并列：页面和海报使用明确稳定排序，不受 SQLite 返回顺序影响；任务 1、4 的测试覆盖。
- 导入想法跨年、无原始日期以及 App 想法处于 UTC 跨年边界：只把可靠本地／原始日期计入年度；任务 1 的测试覆盖。
- 快速切换年份、查询失败重试、从后台或详情返回：旧请求不能覆盖新年份，错误不能伪装成零数据；任务 3 的测试覆盖。
- 封面加载失败、用户快速连续点击保存／分享、组件卸载后异步完成：使用默认封面、防重复操作且不在卸载后写状态；任务 4、5 的测试覆盖。

---

## 文件分工

- 新建 `src/books/annualSummaryRepository.ts`：年度总结所需 SQLite 查询、日期归属、去重、排名与代表书候选。
- 新建 `src/books/annualStoryPages.ts`：把总结编排成有序动态页面，不含 React Native UI。
- 新建 `src/books/AnnualStoryPager.tsx`、`src/books/AnnualStoryPageView.tsx`：横向分页、进度、单页视觉和详情导航。
- 新建 `src/books/annualSummarySnapshot.ts`、`src/books/AnnualSummaryPoster.tsx`：隐私设置、海报不可变快照和可截图视图。
- 新建 `src/books/AnnualSummarySharePanel.tsx`：海报预览、隐私开关、保存与系统分享。
- 新建 `src/app/settings/annual-summary.tsx`：年份、加载、错误、空状态和统一总结状态；修改 `src/storage/AppProvider.tsx`、`src/app/settings/overview.tsx`、`src/app/_layout.tsx` 完成接线。
- 新建对应 `tests/books/annualSummary*.test.*`，并扩展入口、路由和现有回顾回归测试。

### Task 1：统一年度总结数据

**Files:**

- Create: `src/books/annualSummaryRepository.ts`
- Create: `tests/books/annualSummaryRepository.test.ts`
- Reuse: `src/books/recapDates.ts`
- Reference: `src/books/annualRecapRepository.ts`

**Interfaces:**

```ts
export type AnnualSummaryBook = {
  bookId: string;
  title: string;
  author: string | null;
  coverUri: string | null;
  bookType: BookType | null;
  tags: { id: string; name: string }[];
  ratingHalfStars: number | null;
  firstFinishedOn: string;
  lastFinishedOn: string;
  rereadCompletionCount: number;
  annualThoughtCount: number;
  annualThoughtImageCount: number;
  currentHighlightCount: number;
};

export type AnnualCount = { key: string; label: string; count: number };
export type AnnualMonth = { month: number; bookCount: number; books: AnnualSummaryBook[] };
export type AnnualThoughtBook = {
  bookId: string;
  title: string;
  coverUri: string | null;
  annualThoughtCount: number;
  annualThoughtImageCount: number;
};

export type AnnualStorySummary = {
  year: number;
  booksReadCount: number;
  books: AnnualSummaryBook[];
  coverBooks: AnnualSummaryBook[];
  firstBook: AnnualSummaryBook | null;
  lastBook: AnnualSummaryBook | null;
  months: AnnualMonth[];
  peakMonths: number[];
  topTags: AnnualCount[];
  topBookTypes: AnnualCount[];
  topAuthors: AnnualCount[];
  highestRatingHalfStars: number | null;
  topRatedBooks: AnnualSummaryBook[];
  fiveStarBookCount: number;
  thoughtCount: number;
  thoughtBookCount: number;
  thoughtImageCount: number;
  currentHighlightCount: number;
  mostThoughtBooks: AnnualThoughtBook[];
  rereadBooks: AnnualSummaryBook[];
  representativeBooks: AnnualSummaryBook[];
};

export class SqliteAnnualSummaryRepository {
  constructor(db: Database);
  availableYears(currentLocalYear: number): Promise<number[]>;
  getYear(year: number): Promise<AnnualStorySummary>;
}
```

- [ ] **Step 1: Write failing aggregation tests.** Add `counts_each_finished_book_once_and_assigns_earliest_month`, covering one book completed in February and October, another completed once in October, and asserting `booksReadCount === 2`, February `1`, October `1`, while the first book has `rereadCompletionCount === 1`.
- [ ] **Step 2: Add reliability tests.** Add `excludes_invalid_unknown_and_legacy_dates`, `uses_local_and_import_note_dates`, and `counts_current_highlights_without_claiming_a_year`; assert invalid `2026-02-30`, missing `ended_on`, `legacy_read_count`, and undated imported thoughts never enter annual totals. Reuse one image in more than one relation and assert `currentHighlightCount` counts distinct `image_id` values attached as highlights to annual completed books.
- [ ] **Step 3: Add ranking and stability tests.** Add `ranks_tags_types_authors_ratings_and_representatives_stably`; assert unique-book weighting, tags and book types requiring at least 2 different books before they become preferences, type labels from `BOOK_TYPE_LABELS`, authors requiring at least 2 different books, current five-star count, representative tie order, and deterministic same-day ordering. Add a thought on a book not completed that year and assert it still contributes to `thoughtCount`, `thoughtBookCount` and `mostThoughtBooks` through `AnnualThoughtBook`, without entering annual completed `books`.
- [ ] **Step 4: Run red tests.** Run `npm.cmd test -- --runInBand tests/books/annualSummaryRepository.test.ts`; expected FAIL because the module and types do not exist.
- [ ] **Step 5: Implement the repository.** Query valid finished-session candidates, book metadata and covers, book tags, annual thoughts and note images, and current highlight relations in focused private methods. Aggregate in TypeScript using `isValidRecapDate`; assign each unique completed book to its earliest completion month; keep annual thought books independent from the completed-book set; produce exactly 12 `AnnualMonth` entries. Only emit tag／type／author preference counts when the winner occurs on at least 2 different completed books; cap `topTags` at 3, `topAuthors` at 2, `topRatedBooks` at 4, `mostThoughtBooks` at 3, `rereadBooks` at 3, and `representativeBooks` at 3.
- [ ] **Step 6: Implement cover selection.** Add a private pure helper that selects at most 6 unique books distributed across the sorted annual list, preserves stable order, and never duplicates books when fewer than 6 exist; test `selects_cover_books_across_the_year_without_duplicates`.
- [ ] **Step 7: Verify and commit.** Re-run Task 1 tests, then `git add src/books/annualSummaryRepository.ts tests/books/annualSummaryRepository.test.ts` and commit `feat: derive promotional annual summary data`.

### Task 2：动态故事页面编排

**Files:**

- Create: `src/books/annualStoryPages.ts`
- Create: `tests/books/annualStoryPages.test.ts`

**Interfaces:**

```ts
export type AnnualStoryPageId =
  | 'cover' | 'books' | 'months' | 'preference' | 'rating'
  | 'archive' | 'reread' | 'representative' | 'share';

export type AnnualStoryPage = { id: AnnualStoryPageId };

export function buildAnnualStoryPages(summary: AnnualStorySummary): AnnualStoryPage[];
export function formatAnnualSummaryDate(value: string): string;
export function peakMonthSentence(summary: AnnualStorySummary): string;
```

- [ ] **Step 1: Write failing eligibility tests.** `builds_full_story_in_fixed_order` expects `cover → books → months → preference → rating → archive → reread → representative → share`; `omits_pages_without_qualifying_data` expects preference absent without a repeated tag or type result, rating and representative absent without ratings, archive absent when all three record counts are zero, and reread absent without ordinal ≥ 2 completion.
- [ ] **Step 2: Pin sparse and empty behavior.** `keeps_core_story_for_one_book` expects cover, books, months and share without duplicate pages; `returns_no_story_for_zero_finished_books` expects `[]`, leaving the route to render the empty state.
- [ ] **Step 3: Pin copy helpers.** Test single peak month, 2–3 tied peak months, more than 3 tied months, one-book first/last copy, and zero-padded valid date formatting. These functions must not infer reading duration or compare a single month against nonexistent activity.
- [ ] **Step 4: Run red tests.** Run `npm.cmd test -- --runInBand tests/books/annualStoryPages.test.ts`; expected FAIL because the module is absent.
- [ ] **Step 5: Implement pure page building.** Keep page eligibility free of React state and navigation. Preference qualifies only when `topTags` or `topBookTypes` is non-empty under Task 1 thresholds; archive qualifies when `thoughtCount + thoughtImageCount + currentHighlightCount > 0`; representative follows `representativeBooks.length > 0`.
- [ ] **Step 6: Verify and commit.** Re-run Task 2 tests and commit `feat: compose adaptive annual story pages`.

### Task 3：年度总结入口与全屏分页体验

**Files:**

- Create: `src/app/settings/annual-summary.tsx`
- Create: `src/books/AnnualStoryPager.tsx`
- Create: `src/books/AnnualStoryPageView.tsx`
- Create: `tests/books/annualSummaryPage.test.tsx`
- Create: `tests/books/AnnualStoryPager.test.tsx`
- Modify: `src/storage/AppProvider.tsx`
- Modify: `src/app/settings/overview.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `tests/books/libraryOverviewPage.test.tsx`

**Interfaces:**

```ts
export function useAnnualSummaryRepository(): SqliteAnnualSummaryRepository;

export function AnnualStoryPager(props: {
  summary: AnnualStorySummary;
  pages: AnnualStoryPage[];
  onOpenBook(bookId: string): void;
}): React.ReactElement;

export function AnnualStoryPageView(props: {
  page: AnnualStoryPage;
  summary: AnnualStorySummary;
  width: number;
  onOpenBook(bookId: string): void;
}): React.ReactElement;
```

- [ ] **Step 1: Write failing route and entry tests.** `opens_current_year_summary_from_recap`, `registers_full_screen_annual_summary_route`, and `keeps_existing_annual_and_themed_recap_entries` assert the “回顾” page promotes `查看 2026 年度总结`, the Stack route hides the default header and supplies an accessible custom close action, and old routes remain available.
- [ ] **Step 2: Write failing async-state tests.** `loads_current_year_and_switches_year`, `resets_to_cover_after_year_change`, `ignores_stale_year_response`, `retries_query_failure`, `refreshes_on_focus`, and `shows_empty_state_without_zero_story` assert exact loading, failure, empty and navigation behavior.
- [ ] **Step 3: Write failing pager tests.** Assert horizontal `pagingEnabled`, stable page keys, progress text based on actual dynamic pages, swipe index updates, previous／next button boundaries, no timer-driven automatic advance, and `onOpenBook` from book-bearing pages. Mock width changes and assert the current index remains valid after rotation or safe-area layout change.
- [ ] **Step 4: Run red tests.** Run `npm.cmd test -- --runInBand tests/books/annualSummaryPage.test.tsx tests/books/AnnualStoryPager.test.tsx tests/books/libraryOverviewPage.test.tsx`; expected route, hook and component failures.
- [ ] **Step 5: Wire the repository.** Add `AnnualSummaryRepositoryContext`, instantiate `SqliteAnnualSummaryRepository(db)` beside the existing annual repository, include it in provider readiness, and export `useAnnualSummaryRepository()`.
- [ ] **Step 6: Implement the route state.** Use `useFocusEffect`, a monotonically increasing request version, and `availableYears()`／`getYear()`; default to local current year, expose an accessible year selector on the cover／top controls, discard stale responses, and distinguish errors from an empty year. The empty state links to existing reading-date editing guidance, base annual recap, and year switching; the custom close action always returns to the existing 回顾 page.
- [ ] **Step 7: Implement pager and cards.** Use a horizontal `FlatList` with `pagingEnabled`, `getItemLayout`, screen-width pages and explicit controls. Render the approved cover, books, month, preference, rating, archive, reread and representative content with the current theme; reuse `BookCover`, use accessible labels, and keep long titles bounded without hiding the full title from accessibility.
- [ ] **Step 8: Verify and commit.** Re-run Task 3 tests, `npx.cmd tsc --noEmit`, and `npx.cmd expo lint --no-cache`; commit `feat: add adaptive annual reading story`.

### Task 4：年度海报快照与隐私设置

**Files:**

- Create: `src/books/annualSummarySnapshot.ts`
- Create: `src/books/AnnualSummaryPoster.tsx`
- Create: `tests/books/annualSummarySnapshot.test.ts`
- Create: `tests/books/AnnualSummaryPoster.test.tsx`

**Interfaces:**

```ts
export type AnnualSummaryPrivacy = {
  showTitles: boolean;
  showCovers: boolean;
  showArchiveStats: boolean;
};

export type AnnualSummarySnapshot = {
  year: number;
  booksReadCount: number;
  tags: string[];
  books: { bookId: string; title: string; coverUri: string | null }[];
  thoughtCount: number | null;
  currentHighlightCount: number | null;
  privacy: AnnualSummaryPrivacy;
  colors: Pick<ThemePalette, 'primary' | 'primarySoft' | 'background' | 'card' | 'text' | 'mutedText' | 'border' | 'rating'>;
};

export const DEFAULT_ANNUAL_SUMMARY_PRIVACY: AnnualSummaryPrivacy;
export function makeAnnualSummarySnapshot(
  summary: AnnualStorySummary,
  privacy: AnnualSummaryPrivacy,
  palette: ThemePalette,
): AnnualSummarySnapshot;

export const AnnualSummaryPoster: React.ForwardRefExoticComponent<{
  snapshot: AnnualSummarySnapshot;
  onReady(ready: boolean): void;
} & React.RefAttributes<View>>;
```

- [ ] **Step 1: Write failing snapshot tests.** Assert default privacy shows titles, covers and archive statistics; hides each category independently; selects 3–5 unique books by representative ranking then annual distribution; caps tags at 3; and never includes author, platform, dropped records, note bodies, image paths outside selected covers, OCR text or IDs in visible copy.
- [ ] **Step 2: Pin tie and sparse rules.** Test identical rating／record scores, one or two annual books, missing tags, missing covers, and the same book appearing in representative and distributed candidates. The result must be stable and duplicate-free.
- [ ] **Step 3: Write failing poster tests.** Assert the main number and branding render; hidden titles are absent from visible text; hidden covers use abstract book-spine blocks; archive statistics disappear together; long titles and 5-book layouts remain inside the fixed poster; `onReady(false → true)` waits only for visible image covers and treats image failure as a ready default-cover fallback.
- [ ] **Step 4: Run red tests.** Run `npm.cmd test -- --runInBand tests/books/annualSummarySnapshot.test.ts tests/books/AnnualSummaryPoster.test.tsx`; expected missing-module failures.
- [ ] **Step 5: Implement immutable snapshot creation.** Copy all visible data and palette values into a new object; do not retain mutable arrays from `AnnualStorySummary`. Apply privacy before rendering, so hidden content is not merely transparent or positioned off-screen.
- [ ] **Step 6: Implement poster rendering.** Use a fixed 360-point export width and content-height layout suitable for a vertical social image; use the current theme for hierarchy, the existing deterministic default cover style for failed／missing covers, and “由 Novel Tracker 记录” branding. Keep the poster independent of navigation and database hooks.
- [ ] **Step 7: Verify and commit.** Re-run Task 4 tests and commit `feat: build private annual summary poster`.

### Task 5：海报预览、保存与系统分享

**Files:**

- Create: `src/books/AnnualSummarySharePanel.tsx`
- Create: `tests/books/AnnualSummarySharePanel.test.tsx`
- Modify: `src/books/AnnualStoryPageView.tsx`
- Reuse: `src/books/recapSharePlatform.ts`
- Extend: `tests/books/recapSharePlatform.test.ts` only if reuse exposes a regression

**Interfaces:**

```ts
export function AnnualSummarySharePanel(props: {
  summary: AnnualStorySummary;
  initialPrivacy?: AnnualSummaryPrivacy;
}): React.ReactElement;
```

- [ ] **Step 1: Write failing interaction tests.** Assert all three privacy switches default on, each immediately rebuilds the preview, and toggling one does not change the others. Confirm story data stays unchanged and settings reset when leaving, reopening, or switching to another year.
- [ ] **Step 2: Write failing lifecycle tests.** Assert save／share remain disabled until visible covers settle, synchronous `busyRef` blocks rapid duplicate presses, generated URI is discarded after success or failure, permission denial leaves sharing available, share unavailability leaves saving available, and completion after unmount does not set state.
- [ ] **Step 3: Pin user-facing result copy.** Save success says `已保存到相册`; denied permission says `未获得相册写入权限，可以改用系统分享`; closing the system sheet says only `系统分享面板已关闭`, never “已发送”。
- [ ] **Step 4: Run red tests.** Run `npm.cmd test -- --runInBand tests/books/AnnualSummarySharePanel.test.tsx tests/books/recapSharePlatform.test.ts`; expected missing-panel failures while existing platform tests stay green.
- [ ] **Step 5: Implement the embedded final page.** `AnnualStoryPageView` renders `AnnualSummarySharePanel` only for the `share` page and passes the already-loaded `AnnualStorySummary`, so browsing and the poster share one query result. The panel owns privacy, immutable snapshot, poster readiness, capture ref and busy state.
- [ ] **Step 6: Reuse platform operations.** Call `captureRecapPng`, then exactly one of `saveRecapPng`／`shareRecapPng`, and always call `discardRecapPng` in `finally`. Do not request media permission before the user taps save.
- [ ] **Step 7: Verify and commit.** Re-run Task 5 tests, Task 3 pager tests, `npx.cmd tsc --noEmit`, and `npx.cmd expo lint --no-cache`; commit `feat: save and share annual summary poster`.

### Task 6：回归、说明与真机交接

**Files:**

- Modify: `README.md`
- Modify: implementation or tests above only when verification finds an in-scope defect

**Interfaces:** None; this task verifies the complete feature without adding another subsystem.

- [ ] **Step 1: Update user documentation.** Describe `回顾 → 查看年度总结`, dynamic pages, data requirements, current-rating／current-highlight wording, privacy switches, save／share behavior, and the fact that unknown dates are not invented.
- [ ] **Step 2: Run focused annual regression.** Run `npm.cmd test -- --runInBand tests/books/annualSummaryRepository.test.ts tests/books/annualStoryPages.test.ts tests/books/annualSummaryPage.test.tsx tests/books/AnnualStoryPager.test.tsx tests/books/annualSummarySnapshot.test.ts tests/books/AnnualSummaryPoster.test.tsx tests/books/AnnualSummarySharePanel.test.tsx tests/books/annualRecapRepository.test.ts tests/books/annualRecapPage.test.tsx tests/books/themedRecapRepository.test.ts tests/books/themedRecapPage.test.tsx tests/books/recapSharePage.test.tsx tests/books/recapSharePlatform.test.ts tests/books/libraryOverviewPage.test.tsx` and require all suites to pass.
- [ ] **Step 3: Run static verification.** Run `npx.cmd tsc --noEmit`, `npx.cmd expo lint --no-cache`, and `git diff --check`; all must exit 0. Do not run the full 88-suite project test set unless focused failures indicate cross-feature risk or the user asks for it.
- [ ] **Step 4: Prepare iPhone acceptance data.** Create or import examples for: one sparse year, one year with 10+ books across several months, tied peak months, repeated tags, missing ratings, five-star ties, long titles, failed remote cover, annual thoughts, note images, current highlights and one genuine reread. Preserve user data and use disposable test books if needed.
- [ ] **Step 5: Perform or hand off real-device checks.** Verify horizontal paging, dynamic page counts, year switching, return refresh, long-title layout, theme changes, privacy toggles, final PNG clarity, photo permission denial, successful save, system share cancellation and default-cover fallback. Record untested native operations as `待真机验收`.
- [ ] **Step 6: Final documentation commit.** Commit README and any verified in-scope fixes as `docs: explain annual reading summary`.
