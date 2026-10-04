# 年度主题回顾卡片 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL: Use `superpowers:executing-plans`, or use `superpowers:subagent-driven-development` only if the user explicitly chooses delegation. Steps use checkbox (`- [ ]`) syntax. Read the spec first.

**Goal / 目标：** 在现有年度回顾中提供“二刷成功”“五星书”“弃读书”三类只读主题卡片。

**Architecture / 架构：** 新的只读仓储从现有书籍和阅读会话按有效结束日期聚合主题，不另存年度结果；日期有效性与现有年度回顾共享。主题页复用现有封面与书籍详情导航，按所选年份刷新。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、Expo SQLite、Jest。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-04-reading-discovery-and-recap-design.md` 的第三节和共用约束。

## Global Constraints / 全局约束

- “二刷成功”仅表示本年有 `ordinal >= 2` 的读完会话；五星按书籍**当前总体评分** `rating_half_stars=10`，并须本年有带有效结束日的读完会话；弃读按本年的历史弃读会话。
- 三类主题按真实 `ended_on` 归年；未知／无效日期和仅有 `legacy_read_count` 的书不进入主题。一本书在同一主题同年只出现一次。
- 主题卡片只在 App 内预览；不生成图片、不分享、不加入 AI 文案、网络请求或新统计表。主题页不得修改任何阅读数据。
- 沿用主题色和 `BookCover` 默认封面；错误显示重试，空数据按主题分别提示。iPhone 未实测不得标为通过。
- Windows 使用 `npm.cmd`／`npx.cmd`；先跑相关测试，收尾类型检查与 lint。

## Review Focus

- 同书首刷和二刷同年完成，只列一次“二刷成功”，显示真实二刷会话；任务 1 测试。
- 书目前为五星但当年无有效读完日期，不能列作当年五星；任务 1 测试。
- 书曾弃读，后来重读成功或状态改变，历史弃读仍出现在对应年份；任务 1 测试。
- 跨年开始／结束、非法日期、同日多书以及同名书不同 ID，归年和顺序稳定；任务 1 测试。
- 只有弃读记录的年份也必须可选；快切年或查询失败后重试，不能展示上个年份的卡片或错误的空状态；任务 1、2 测试。

---

## 文件分工

- 新建 `src/books/recapDates.ts`、`tests/books/recapDates.test.ts`；修改 `src/books/annualRecapRepository.ts`：共用严格日历日期判断，保持原年度回顾语义。
- 新建 `src/books/themedRecapRepository.ts`、`tests/books/themedRecapRepository.test.ts`：三类主题的只读查询与聚合。
- 新建 `src/app/settings/themed-recap.tsx`、`tests/books/themedRecapPage.test.tsx`：年份切换、卡片、空状态和详情导航。
- 修改 `src/storage/AppProvider.tsx`、`src/app/settings/annual-recap.tsx`、`src/app/_layout.tsx`、相关页面测试和 `README.md`：仓储接线与年度回顾入口。

### 任务 1：主题数据与严格日期规则

**文件：** 新建 `src/books/recapDates.ts`、`src/books/themedRecapRepository.ts`、`tests/books/recapDates.test.ts`、`tests/books/themedRecapRepository.test.ts`；修改 `src/books/annualRecapRepository.ts`、`tests/books/annualRecapRepository.test.ts`。

**Interfaces:** `isValidRecapDate(value: string | null): value is string` 从现有年度仓储的 `isValidCalendarDate` 提取，严格接受真实 `YYYY-MM-DD` 日期。`ThemeRecapSession = { id: string; ordinal: number; startedOn: string | null; endedOn: string; outcome: 'finished' | 'dropped' }`；`ThemeRecapBook = { bookId: string; title: string; coverUri: string | null; currentRatingHalfStars: number | null; sessions: ThemeRecapSession[] }`；`ThemedRecap = { year: number; rereadBooks: ThemeRecapBook[]; fiveStarBooks: ThemeRecapBook[]; droppedBooks: ThemeRecapBook[] }`。`SqliteThemedRecapRepository(db)` 提供 `getYear(year: number): Promise<ThemedRecap>` 和 `availableYears(currentLocalYear: number): Promise<number[]>`；年份只接受 1～9999 整数，后者包含有效读完／弃读结束年份与当前年并降序。每个主题的 `sessions` 只含该年符合该主题的记录；五星书的 `sessions` 是该年全部有效读完记录。

- [ ] **步骤 1：写失败测试。** `groups_finished_rereads_by_book_id` 检查二刷／三刷同年只一书、首刷不计、两条真实会话都保留；`five_star_means_current_overall_rating` 检查评分 10 且本年有读完日期、评分 9 或无日期不计；`keeps_historical_drops_after_status_changes` 检查弃读后重读仍归原年；`rejects_invalid_and_unknown_dates` 覆盖 2026-02-30、`null`、跨年和旧 `legacy_read_count`；`available_years_includes_drop_only_year` 检查只有弃读的年份可选；`sorts_ties_and_same_titles_by_stable_id` 检查主题卡片与会话排序；`keeps_existing_annual_recap_dates` 确认提取日期函数后旧年度结果不变。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/recapDates.test.ts tests/books/themedRecapRepository.test.ts tests/books/annualRecapRepository.test.ts`；预期新仓储或断言失败。
- [ ] **步骤 3：实现只读仓储。** 从 `reading_sessions` JOIN `books` 和封面资产读取 `finished`／`dropped` 候选，先严格验证 `ended_on` 再按年份与条件分组。每类用 `bookId` 去重，书内按结束日期、阅读序号、会话 ID 排序；书卡按最近有效结束日期降序，同日按书名与书籍 ID 升序。抽出共同日期判断供旧年度仓储复用，不改变它的数字、想法归属或 SQL 写入行为。
- [ ] **步骤 4：运行绿灯。** 重跑步骤 2；全部通过。

### 任务 2：主题页面与年度入口

**文件：** 新建 `src/app/settings/themed-recap.tsx`、`tests/books/themedRecapPage.test.tsx`；修改 `src/storage/AppProvider.tsx`、`src/app/settings/annual-recap.tsx`、`src/app/_layout.tsx`、`tests/books/annualRecapPage.test.tsx`、`README.md`。

**Interfaces:** `useThemedRecapRepository(): SqliteThemedRecapRepository`。年度回顾增加“主题回顾”入口，传所选 `year` 到 `/settings/themed-recap`；主题页通过路由参数读取年份，缺失／无效时用设备当前本地年，切换年份调用 `getYear(year)`。年份选择是主题仓储 `availableYears(currentLocalYear)` 与现有 `useAnnualRecapRepository().availableYears(currentLocalYear)` 的并集，降序显示：弃读独有年份和仅有想法的年份都可进入。书卡导航 `{ pathname: '/book/[id]', params: { id: bookId } }`。

- [ ] **步骤 1：写失败页面测试。** `opens_themed_recap_for_selected_year` 检查入口和年份；`shows_three_topics_and_true_dates` 检查每个主题独立结果、当前总体评分说明及真实日期；`shows_independent_empty_states` 检查一个主题为空不隐藏另外两项；`ignores_stale_year_response_and_retries_error` 用延迟查询检查快切年份、失败后重试；`opens_exact_book_id` 检查同名书跳转正确且没有写库动作。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/themedRecapPage.test.tsx tests/books/annualRecapPage.test.tsx`；预期新路由或入口断言失败。
- [ ] **步骤 3：实现页面与接线。** Provider 注入新仓储，年度页入口只在用户主动点击时导航。主题页从查询返回值展示三个独立区块，复用 `BookCover` 和主题色；用请求序号或 effect 清理防止上一个年份结果覆盖新年份，聚焦页面时刷新，错误显示重试，空状态不伪造书目。更新 README 操作入口。
- [ ] **步骤 4：运行绿灯。** 重跑步骤 2，再运行 `npx.cmd tsc --noEmit`、`npm.cmd run lint`、`git diff --check`；全部通过。

### 任务 3：集中验收

**文件：** 只修复本功能发现的缺陷。

- [ ] **步骤 1：运行定向回归。** `npm.cmd test -- --runInBand tests/books/recapDates.test.ts tests/books/themedRecapRepository.test.ts tests/books/themedRecapPage.test.tsx tests/books/annualRecapRepository.test.ts tests/books/annualRecapPage.test.tsx`；确认通过。
- [ ] **步骤 2：交付 iPhone 检查。** 年度回顾切到有二刷、五星、弃读及无记录年份，再进入主题回顾；核对一本书在三类中的真实归属、点卡片进入详情和返回刷新。未收到实机结果则标记待验收。
