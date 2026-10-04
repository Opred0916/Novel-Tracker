# 导入完成页 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL: Use `superpowers:executing-plans`, or use `superpowers:subagent-driven-development` only if the user explicitly chooses delegation. Steps use checkbox (`- [ ]`) syntax. Read the spec first.

**Goal / 目标：** 旧记录整批提交成功后，用“导入完成”页准确展示本次写入成果和两个后续入口。

**Architecture / 架构：** 扩展现有 `ImportSummary`，从已确认的导入候选计算将被写入的数量，并仅在 `ImportCommitService.commit()` 事务成功后返回。导入路由保留成功摘要在内存中，切换到完成视图；不新增导入历史表或备份字段。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、Expo SQLite、Jest。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-04-reading-discovery-and-recap-design.md` 的第二节和共用约束。

## Global Constraints / 全局约束

- 页面标题统一为“导入完成”；仅在事务真正成功后出现。取消、校验失败与事务回滚时原预览保留。
- 所有数字只代表本次新写入数据；已有目标书的旧资料、旧想法和旧阅读记录不算新增。未知日期不填今天。
- 完成页只在当前导入会话显示，不持久化旧批次结果；无敏感正文或截图复制到路由参数。
- 含截图的导入提交成功后，即使临时副本清理失败，也不能误报“导入失败”并允许重复提交。
- 不改数据库模式、备份或开放导出格式；不加原生依赖。Windows 用 `npm.cmd`／`npx.cmd`，先定向验证。

## Review Focus

- 读完书没有显式会话时，真实写入日期未知的首刷，新增阅读记录数要加一而最早日期仍未知；任务 1 测试。
- “向现有书追加想法”两条候选指向同一本书时，追加目标书数只能算一；任务 1 测试。
- 只有旧书已有五星或二刷、本次只追加想法时，本次五星／重读数仍为零；任务 1 测试。
- 事务中段失败和用户取消时不能出现完成视图或失去预览；任务 2 测试。
- 截图副本清理失败但提交成功时仍显示成功摘要，不能二次提交；任务 2 测试。

---

## 文件分工

- 修改 `src/import/importReview.ts`、`tests/import/importReview.test.ts`：扩展 `ImportSummary` 并计算提交候选的统计。
- 修改 `src/import/importCommitService.ts`、`tests/import/importCommitService.test.ts`：事务成功才返回摘要；核对写入计数。
- 新建 `src/import/ImportCompletionView.tsx`、`tests/import/ImportCompletionView.test.tsx`：结果展示与导航动作。
- 修改 `src/app/settings/import.tsx`、`tests/import/importPage.test.tsx`、`tests/import/tableImportPage.test.tsx`、截图导入页面测试及 `README.md`：所有来源走同一完成流程。

### 任务 1：准确的成功摘要

**文件：** 修改 `src/import/importReview.ts`、`src/import/importCommitService.ts`、`tests/import/importReview.test.ts`、`tests/import/importCommitService.test.ts`。

**Interfaces:** 在现有 `ImportSummary` 的 `createdBooks`、`createdNotes`、`appendedNotes`、`skippedItems` 后增加 `createdSessions: number`、`appendedBookCount: number`、`rereadSessions: number`、`fiveStarBooks: number`、`earliestRecordedOn: string | null`。`summarizeImport(review: ImportReview): ImportSummary` 只计 `create`／`append_notes` 实际会写的项；`commit(review): Promise<ImportSummary>` 保持签名，在独占事务完成后才返回。`createdSessions` 计显式会话；非想读新书没有显式会话时按现有导入规则计一条日期未知记录。`earliestRecordedOn` 仅取本次新增会话有效开始／结束日与本次新增想法有效原日期的最小值；`appendedBookCount` 按不同 `targetBookId` 去重。

- [ ] **步骤 1：写失败测试。** `counts_implicit_undated_session_without_earliest_date` 测一部读完新书无显式日期为 1 条会话、最早日期 `null`；`counts_real_dated_sessions_and_rereads` 测首刷、二刷、三刷与跨年最早日期；`deduplicates_append_targets_and_ignores_existing_data` 测两个追加候选指向同一旧书且旧书已有五星和阅读历史，结果只计新想法、一个追加目标；`counts_five_star_new_books_only` 测总体评分 `10` 与 `9`；修改原有精确摘要断言，核对事务失败不返回摘要。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/import/importReview.test.ts tests/import/importCommitService.test.ts`；预期新字段断言失败。
- [ ] **步骤 3：实现统计。** 使用当前 `validateImportReview` 后的最终候选；对新增书复用 `insertSessions` 的隐含首刷规则，确保计算与写入一致。日期只比较完整有效的 `YYYY-MM-DD`；不从导入操作时间推断。保留旧四个字段以兼容现有预览文案，更新引用 `ImportSummary` 的测试桩。
- [ ] **步骤 4：运行绿灯。** 重跑步骤 2；全部通过。

### 任务 2：完成视图与统一提交出口

**文件：** 新建 `src/import/ImportCompletionView.tsx`、`tests/import/ImportCompletionView.test.tsx`；修改 `src/app/settings/import.tsx`、`tests/import/importPage.test.tsx`、`tests/import/tableImportPage.test.tsx`、已有截图导入页面测试、`README.md`。

**Interfaces:** `ImportCompletionView({ summary, onOpenBookshelf, onOpenAnnualRecap }: { summary: ImportSummary; onOpenBookshelf(): void; onOpenAnnualRecap(): void })`。`ImportPage` 增加 `completion: ImportSummary | null`，`confirm()` 在 `await service.commit(review)` 成功后立即设置完成态并清掉可再次提交的预览；截图临时文件清理单独以 best effort 执行，不再作为事务成功与否的判据。当前路由的导航标题在完成态为“导入完成”；两个按钮分别去书架和现有年度回顾。

- [ ] **步骤 1：写失败页面测试。** `shows_completion_only_after_successful_commit` 覆盖粘贴文字、表格和截图均从同一 `confirm()` 到结果，标题与数字准确；`keeps_review_on_failure_or_cancel` 验证不出现成功结果；`survives_cleanup_failure_after_commit` 验证截图临时文件清理拒绝后仍显示成功且无法再提交；`opens_bookshelf_and_recap` 验证两个出口；视图测试 `renders_unknown_date_and_optional_stats` 验证无确切日期时显示“日期未记录”、零值不出现误导性年份。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/import/ImportCompletionView.test.tsx tests/import/importPage.test.tsx tests/import/tableImportPage.test.tsx tests/import/screenshotImportSource.test.tsx`；预期新增断言失败。
- [ ] **步骤 3：实现完成视图与接线。** 使用当前主题的颜色与间距；书籍、想法、阅读记录的数量标清“本次”。在成功状态屏蔽再次确认；错误时保留 `ImportReviewList` 的内容和可重试入口。截图副本清理失败只记录可恢复的清理错误，不调用 `commit()` 第二次，也不把成功页改成失败页。更新 README 的操作路径。
- [ ] **步骤 4：运行绿灯。** 重跑实际存在的定向测试，运行 `npx.cmd tsc --noEmit`、`npm.cmd run lint`、`git diff --check`；全部通过。

### 任务 3：集中验收

**文件：** 只有范围内缺陷需要修复时才修改对应代码或测试。

- [ ] **步骤 1：回归导入来源。** 运行 `npm.cmd test -- --runInBand tests/import`，确保旧的文字、表格、截图、重复项和事务回滚语义保持。
- [ ] **步骤 2：交付 iPhone 检查。** 分别成功导入一条文字、一份表格、一组截图；查看“导入完成”、最早日期、想法／阅读记录数和两个出口；取消及错误时确认没有成功页。未实测标记待验收。
