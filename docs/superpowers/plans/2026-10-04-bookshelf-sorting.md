# 书架排序 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task, or `superpowers:subagent-driven-development` if the user explicitly chooses delegation. Steps use checkbox (`- [ ]`) syntax for tracking. Read the spec first.

**Goal / 目标：** 让书架及其搜索／筛选结果可按最近修改、最近读完、最近添加或总体评分排序。

**Architecture / 架构：** 现有搜索仓储仍决定结果集合和命中依据，新增纯函数统一比较顺序；选择最近读完时，仓储一次读取完成日期并为每本书取最新有效日期。书架页面只维护当前排序选择，并将它交给现有 `useBookSearch` 请求链；不写书库或新增迁移。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、Expo SQLite、Jest；Windows PowerShell 使用 `npm.cmd`／`npx.cmd`。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-04-bookshelf-sorting-design.md`

## Global Constraints / 全局约束

- 排序选项恰为“最近修改”“最近读完”“最近添加”“评分从高到低”；首次进入默认最近修改，重新启动 App 后恢复默认，不持久化偏好。
- 排序只改变顺序；关键词、状态、作品类型及多标签筛选的结果集合与命中摘记／图片提示不变。“清除筛选”保留排序，筛选数量不计排序。
- 最近读完仅取 `outcome='finished'` 的最新有效 `ended_on`；无有效日期排后，不能用导入日、书籍状态或旧版阅读次数推断。日期必须是有效的四位 `YYYY-MM-DD` 日历日期。
- 最近添加按 `created_at` 降序；评分按 `rating_half_stars` 降序且 `null` 排后；最近修改沿用 `updated_at` 降序。主值相同按 `updated_at` 降序、书籍 ID 升序稳定排序。
- 不新增依赖、数据库列或迁移，不更改备份／开放导出。开发时只跑相关定向测试，最后做一次类型检查、lint 和差异检查；iPhone 未实测不得标为通过。

## Review Focus

- 二刷读完、后来改为在读以及较新的弃读记录：只取该书最新的真实读完日期；任务 1 测试覆盖。
- 导入书无完成日期、非法日期和旧版阅读次数：最近读完排序中排到有日期的书后；任务 1 测试覆盖。
- 半星评分并列、未评分与同日读完：按次级规则稳定排序，未评分始终在已评分后；任务 1 测试覆盖。
- 关键词／状态／类型／多标签组合：换排序不增加或漏掉结果，也不丢命中摘记／图片提示；任务 1 和任务 2 测试覆盖。
- 快速切换排序、查询失败重试、进入详情再返回：旧响应不能覆盖新顺序，所选排序仍用于当前页面刷新；任务 2 测试覆盖。

---

## 文件分工

- 修改 `src/books/bookSearch.ts`：`BookSortOrder` 与搜索参数；新建 `src/books/bookSearchSort.ts`：纯排序比较与完成日有效性判断。
- 修改 `src/books/bookSearchRepository.ts`：筛选后取得结果，按选定规则排序；仅“最近读完”额外批量读取 `reading_sessions`。扩展 `tests/books/bookSearchRepository.test.ts`，新建 `tests/books/bookSearchSort.test.ts`。
- 修改 `src/books/useBookSearch.ts`：把排序变化纳入请求依赖；修改 `src/app/index.tsx`：排序选择入口与当前状态。扩展 `tests/books/bookRoutes.test.tsx`。
- 修改 `README.md`：补充书架排序用法；不改数据库、备份或导出文件。

### 任务 1：排序规则与搜索仓储

**文件：** 修改 `src/books/bookSearch.ts`、`src/books/bookSearchRepository.ts`、`tests/books/bookSearchRepository.test.ts`；新建 `src/books/bookSearchSort.ts`、`tests/books/bookSearchSort.test.ts`。

**Interfaces:** `BookSortOrder = 'recently_updated' | 'recently_finished' | 'recently_added' | 'rating_high'`；`BookSearchFilters` 增加可选 `sortOrder?: BookSortOrder`，省略时视为 `recently_updated`，兼容已有调用者。新建 `isValidFinishedDate(value: string | null): value is string` 供仓储过滤日期；`sortBookSearchResults(results: BookSearchResult[], order: BookSortOrder, latestFinishedOnByBookId: ReadonlyMap<string, string>): BookSearchResult[]` 返回新数组，不改变每项的命中信息。

- [ ] **步骤 1：写失败测试。** 在 `bookSearchSort.test.ts` 断言四种排序的书籍 ID 顺序；最近读完的空日期、非法 `2026-02-30` 与同日并列；评分 `9` 高于 `8`、`null` 最后，主值相同时按修改时间和 ID。断言输入数组未被原地改动。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/bookSearchSort.test.ts`；预期缺少排序函数或断言失败。
- [ ] **步骤 3：实现纯排序函数。** 在 `bookSearchSort.ts` 按接口比较 `BookSearchResult.book` 与日期映射；`isValidFinishedDate` 使用严格日历校验，年范围 1～9999；主值缺失的项排后，再按 `updatedAt`、ID 比较。`BookSearchFilters.sortOrder` 未传时由仓储使用默认值。
- [ ] **步骤 4：绿灯。** 重跑步骤 2；预期通过。
- [ ] **步骤 5：写仓储失败测试。** 在 `bookSearchRepository.test.ts` 加入两本不同完成日期的书、同书二刷、较晚弃读及无日期导入书；断言最近读完只取有效完成日。另断言四种顺序与现有关键词／状态／类型／多标签查询可组合，摘记和图片命中依据不变，省略 `sortOrder` 的老调用仍按最近修改排列。
- [ ] **步骤 6：运行红灯。** `npm.cmd test -- --runInBand tests/books/bookSearchRepository.test.ts`；预期新增顺序断言失败。
- [ ] **步骤 7：接入仓储。** 保留现有 WHERE 条件与命中摘记／图片逻辑；仅在 `sortOrder === 'recently_finished'` 时一次查询 `reading_sessions` 中读完且有结束日的记录，用 `isValidFinishedDate` 过滤后，只为当前结果书籍求最大日期。对构成的 `BookSearchResult[]` 调用任务接口排序；不按每本书单独查完成日期。
- [ ] **步骤 8：绿灯并提交。** 重跑步骤 6；预期通过。提交 `feat: sort filtered bookshelf results`。

### 任务 2：书架选择器与请求更新

**文件：** 修改 `src/books/useBookSearch.ts`、`src/app/index.tsx`、`tests/books/bookRoutes.test.tsx`、`README.md`。

**Interfaces:** 书架以 `useState<BookSortOrder>('recently_updated')` 保存当前选择，向 `useBookSearch(repository, { query, status, bookType, tagIds, sortOrder })` 传入；`useBookSearch` 的稳定参数及 effect 依赖包括 `sortOrder`。书架展示四个互斥选择及当前值；`clearFilters()` 不修改 `sortOrder`。

- [ ] **步骤 1：写失败页面测试。** 在 `bookRoutes.test.tsx` 断言默认传 `recently_updated`；选“最近读完”后请求带 `sortOrder: 'recently_finished'`，选项可见且已选中；清除关键词／筛选后仍保留排序；从详情返回重查仍带所选排序；空列表仍可选排序。用延迟 Promise 模拟快速切换，断言旧请求不会覆盖最终列表；查询失败时仍有重试。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/bookRoutes.test.tsx`；预期新增入口或参数断言失败。
- [ ] **步骤 3：实现页面与 hook。** 在搜索框附近放紧凑的“排序：当前选项”按钮；展开后显示四个具备 `accessibilityRole='radio'` 和 `accessibilityState.checked` 的选项，选中后收起。将 `sortOrder` 加入 `useBookSearch` 的 memo 依赖；沿用已有请求编号、加载与重试机制。更新 README 的书架使用说明。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2；预期通过。提交 `feat: choose bookshelf sort order`。

### 任务 3：集中验证与真机交接

**文件：** 仅在发现本计划范围内的问题时修改对应文件；无需独立功能。

- [ ] **步骤 1：定向回归。** 运行 `npm.cmd test -- --runInBand tests/books/bookSearchSort.test.ts tests/books/bookSearchRepository.test.ts tests/books/bookSearch.test.ts tests/books/bookRoutes.test.tsx`；再运行 `npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache` 和 `git diff --check`。若有失败，只扩展到相关测试定位。
- [ ] **步骤 2：真机验收清单。** 在 iPhone 书架分别选四种顺序；核对有／无读完日期、已／未评分书的位置；组合关键词、状态、作品类型、标签并清除筛选；编辑一本书的评分或完成日期后返回确认顺序刷新。报告实际通过项及未验证项。
- [ ] **步骤 3：交接。** 核对提交和工作区状态；是否合并并上传按用户后续要求执行。
