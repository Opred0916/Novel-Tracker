# 年度阅读回顾 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or, if the user explicitly chooses delegation, `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the spec first.

**Goal / 目标：** 从书库概览进入按年份查看的只读回顾，准确展示读完书数、完成阅读次数和当年的想法，并可点开对应书与摘记。

**Architecture / 架构：** 独立只读仓储从现有 SQLite 书籍、阅读记录、摘记表生成可选年份和单年数据，页面只负责展示与导航。阅读按有效结束日归年；App 想法按设备本地写作日、导入想法按原始记录日归年。年度数字直接从展示列表计算，不另存统计表。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、Expo SQLite、Jest；Windows PowerShell 用 `npm.cmd`／`npx.cmd`，项目无 Bun 锁文件。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-04-annual-reading-recap-design.md`

## Global Constraints / 全局约束

- 页面只读、本地运行；不调用 AI 或网络，不加会员检查，不修改备份及开放导出格式，不创建年度统计表。
- “读完 X 本”按同年有效完成记录的不同书籍数，“完成阅读 X 次”按记录条数；当前书籍状态和 `legacy_read_count` 不决定年度归属。
- App 想法按 `created_at` 转换出的设备本地日历年，导入想法按有效 `original_recorded_on`；无原始日期的导入想法单列“日期未记录”，不计入任何年。
- 提供有确切完成日期／想法日期的所有年份和当前本地年；无效日期不生成年份。阅读 `YYYY-MM-DD`、导入想法原日期不做时区转换。
- 概览入口保留现有统计；年度页面返回后刷新。封面复用 `BookCover` 的带书名默认图，不能把当前总体评分标成历史评分。
- 依照用户之前的速度偏好，开发时运行相关定向测试；收尾做一次集中回归、类型检查和 lint。iPhone 未实测不得标为通过。

## Review Focus

- 同一书同年完成多次或跨年完成，书数、次数、卡片中的阅读条目须分别正确；任务 1 的测试覆盖。
- UTC 时间戳在设备本地跨年，App 想法须归本地年份；导入想法不得按导入时间归年；任务 1 的测试覆盖。
- 只有旧阅读次数、无效结束日或无原始日期的旧想法，不能凭当前状态／导入日混进年度数字；任务 1 的测试覆盖。
- 快速切换年份、查询失败后重试或从详情返回，不能让旧请求覆盖新年份，也不能把失败显示成 0；任务 2 的测试覆盖。
- 同名书、已删除摘记或不属于目标书的 `focusNoteId`，不能误定位／展示别的书的文字和图片；任务 3 的测试覆盖。

---

## 文件分工

- 新建 `src/books/annualRecapRepository.ts`：有效日期、本地年份、已完成阅读聚合、想法归属和无日期想法；新建 `tests/books/annualRecapRepository.test.ts`。
- 新建 `src/app/settings/annual-recap.tsx`：年度页面、年份切换、空状态、错误重试和卡片导航；新建 `tests/books/annualRecapPage.test.tsx`。
- 修改 `src/storage/AppProvider.tsx`：注入年度仓储与 `useAnnualRecapRepository()`；修改 `src/app/settings/overview.tsx` 和 `tests/books/libraryOverviewPage.test.tsx`：概览入口。
- 修改 `src/app/book/[id].tsx`、`src/books/NotesSection.tsx`，并扩展 `tests/books/bookRoutes.test.tsx`、新建 `tests/books/NotesSection.test.tsx`：按所属书核对摘记并定位，修正导入摘记的详情日期显示。

### 任务 1：只读年度数据与日期归属

**文件：** 新建 `src/books/annualRecapRepository.ts`、`tests/books/annualRecapRepository.test.ts`。

**Interfaces:** `RecapSession = { id: string; ordinal: number; startedOn: string | null; endedOn: string }`；`RecapBook = { bookId: string; title: string; coverUri: string | null; sessions: RecapSession[] }`；`RecapNote = { id: string; bookId: string; bookTitle: string; body: string; recordedOn: string | null; recordedTime: string | null; imageCount: number }`；`AnnualRecap = { year: number; finishedBookCount: number; completedReadingCount: number; thoughtCount: number; books: RecapBook[]; thoughts: RecapNote[] }`。`SqliteAnnualRecapRepository(db)` 提供 `availableYears(currentLocalYear: number): Promise<number[]>`、`getYear(year: number): Promise<AnnualRecap>`、`listUndatedThoughts(): Promise<RecapNote[]>`；导出 `getNoteRecordedOn(note: Pick<Note, 'sourceKind' | 'originalRecordedOn' | 'createdAt'>): string | null` 供详情复用同一日期规则。`currentLocalYear` 与 `year` 只接受 1～9999 的整数；年份列表降序。`recordedOn` 为显示用本地／原始 `YYYY-MM-DD`；无日期条目为 `null`。

- [ ] **步骤 1：写失败测试。** `counts_distinct_books_and_completed_sessions` 断言同书同年二刷为 1 本／2 次、跨年从完成日归属、弃读与在读不计、当前状态改变不影响历史；`excludes_unknown_legacy_and_invalid_dates` 断言 `legacy_read_count`、无结束日和 `2026-02-30` 均不进书单或可选年份；`assigns_app_notes_in_local_calendar` 用固定跨年 UTC 时间戳和指定测试时区断言归属本地年；`uses_import_original_date_and_separates_unknown` 断言导入日不冒充原日期、无日期只在单独列表；`orders_ties_and_years_stably` 断言卡片、阅读条目、想法和年份顺序，注有正文图片时 `imageCount` 准确。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/annualRecapRepository.test.ts`；预期新仓储缺失或新增断言失败。
- [ ] **步骤 3：实现仓储。** 从 `reading_sessions` JOIN `books` 读取 `outcome='finished'` 候选；严格验证日历日期后按结束年分组，书内按结束日降序、同日按 ordinal 降序和 ID 稳定排序。想法从 `notes` JOIN `books` 并统计 `note_images`；`getNoteRecordedOn` 对 App 时间戳用 `Date` 本地年月日，对导入项只采用有效原日期，无日期／无效日期均进独立列表。所有数字从过滤后的列表长度计算；`availableYears` 是有效年份与当前年之并集。书卡按最近完成日降序、同日按书名／ID 固定排序；想法按记录日、记录时刻降序，同刻按 ID 排序。不写库，不增加迁移。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2；提交 `feat: derive annual recap from local reading records`。

### 任务 2：年度页面与书库概览入口

**文件：** 新建 `src/app/settings/annual-recap.tsx`、`tests/books/annualRecapPage.test.tsx`；修改 `src/storage/AppProvider.tsx`、`src/app/settings/overview.tsx`、`tests/books/libraryOverviewPage.test.tsx`。

**Interfaces:** `useAnnualRecapRepository(): SqliteAnnualRecapRepository`；年度页调用任务 1 的三个查询，默认年为 `new Date().getFullYear()`，年份切换时读取 `getYear(year)`；“日期未记录”是独立可展开区，读取 `listUndatedThoughts()`，与所选年数字无关。书卡导航 `{ pathname: '/book/[id]', params: { id: bookId } }`；想法导航另加 `focusNoteId: note.id`，供任务 3 消费。

- [ ] **步骤 1：写失败页面测试。** `opens_recap_from_overview` 断言概览原有统计仍在、入口路由正确；`shows_counts_books_thoughts_and_switches_year` 断言默认当前年、仅已有年份和当前年可选、二刷条目与未知开始日期文案、封面失败回退标题图、书卡与想法路由参数；`shows_independent_empty_and_undated_sections` 断言仅书籍区为空不隐藏想法，独立无日期想法不计数；`ignores_stale_response_and_retries_error` 用延迟 Promise 断言快切年份不混入旧结果、失败显示重试、返回焦点刷新。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/annualRecapPage.test.tsx tests/books/libraryOverviewPage.test.tsx`；预期新路由／入口测试失败。
- [ ] **步骤 3：实现页面与接线。** `AppProvider` 实例化年度仓储并提供 hook；概览加“年度阅读回顾”入口。新页面用 `useFocusEffect` 读取当前年份和可选年份，查询按请求序号或 effect 清理防止旧结果覆盖；年份切换和重试重新读取。复用 `BookCover`，显示 0 数字、两个独立空状态、无日期说明与返回书架入口；点卡片按接口导航，恢复焦点后重查。无日期列表中的条目也能按 `focusNoteId` 导航。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2，运行 `npx.cmd tsc --noEmit` 与 `npx.cmd expo lint --no-cache`；提交 `feat: show annual reading recap in app`。

### 任务 3：从回顾定位正确摘记

**文件：** 修改 `src/app/book/[id].tsx`、`src/books/NotesSection.tsx`；新建 `tests/books/NotesSection.test.tsx`，扩展 `tests/books/bookRoutes.test.tsx`。

**Interfaces:** 详情页读取可选 `focusNoteId?: string`，只在当前书 `notesRepo.listNotes(bookId)` 的结果中确认目标；`NotesSection` 新增可选 `focusNoteId?: string` 与 `onFocusResult?: (found: boolean, contentY?: number) => void`，在笔记加载后将匹配项做视觉强调，待容器与条目均完成布局时报告二者相加的 ScrollView 内容区 Y 坐标；未找到时只报告 `false`。详情 `ScrollView` 据此滚动。现有 `focusImageId` 预览逻辑不变。详情中导入想法显示 `originalRecordedOn` 或“日期未记录”，App 想法显示 `createdAt` 的设备本地日期，不用 UTC 字符串截取。

- [ ] **步骤 1：写失败测试。** `focuses_only_note_in_current_book` 断言合法 ID 的全文和图片仍在当前书详情、定位到该条且有可见强调；`missing_or_foreign_note_does_not_show_other_book` 断言目标已删或 ID 属别书时仅提示“这条想法已不存在”，不显示其他书内容；`uses_original_or_local_date_in_detail` 断言导入有／无原日期及 App 跨年 UTC 时间戳的文案；`existing_image_focus_still_works` 防止 OCR 图片直达回归。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/NotesSection.test.tsx tests/books/bookRoutes.test.tsx`；预期新增断言失败。
- [ ] **步骤 3：实现定位。** 在 `NotesSection` 已加载的当前书摘记内匹配 ID；用被匹配条目的布局位置驱动详情 `ScrollView.scrollTo`，在列表加载、焦点参数或路由变化时重新定位，避免未布局前滚动。未匹配只显示温和提示，不按书名或数组索引猜另一条。日期展示沿用任务 1 的归属规则，原详情的增删改与图片点击保持可用。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2，运行 `npx.cmd tsc --noEmit` 与 `npx.cmd expo lint --no-cache`；提交 `feat: jump from recap to matching thought`。

### 任务 4：集中回归与真机交接

**文件：** 只在发现本计划范围内回归时修改对应文件；无需增加独立功能或迁移。

- [ ] **步骤 1：集中验证。** `npm.cmd test -- --runInBand tests/books/annualRecapRepository.test.ts tests/books/annualRecapPage.test.tsx tests/books/libraryOverviewRepository.test.ts tests/books/libraryOverviewPage.test.tsx tests/books/NotesSection.test.tsx tests/books/bookRoutes.test.tsx`，再运行 `npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`git diff --check`；失败时只扩大到相关测试，不默认跑无关全量套件。
- [ ] **步骤 2：人工验收清单。** 在 iPhone 打开“书库概览 → 年度阅读回顾”，切换有／无记录年份，核对二刷数字、跨年日期、想法及“日期未记录”；点书与想法看详情，返回后修改一条记录再核对刷新。记录实际通过与未验证项；不能把单元测试通过写成真机通过。
- [ ] **步骤 3：交接。** 确认工作树和提交记录；按用户当时要求再决定合并、上传，不在本计划执行时自行推送。
