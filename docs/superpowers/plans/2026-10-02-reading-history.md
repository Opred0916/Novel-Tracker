# 多次阅读记录实施计划

> **供执行者阅读：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项实施本计划。任务进度使用复选框（`- [ ]`）记录。

**目标：** 通过已有阅读状态自动维护首刷、二刷及后续阅读记录，允许编辑日期和删除误记录，并无损升级现有书库。

**架构：** SQLite 新增独立阅读记录表及旧“读完”书的历史标记；书籍仓储在同一事务内处理状态和阅读记录。独立历史仓储负责读取、补记、改日期与删除；表单预览即将发生的状态转换，详情页展示与修正历史。

**技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、`expo-sqlite`、Jest、React Native Testing Library、Node `node:sqlite`；不新增依赖。

**设计文档：** `docs/superpowers/specs/2026-10-02-reading-history-design.md`

## 全局约束

- 仍使用 `want_to_read`／`reading`／`finished`／`dropped` 四种书籍状态，不增加独立的开始或结束阅读按钮。
- 新建“想读”不产生记录；新建其他状态产生首刷。状态从非在读改为在读产生下一次记录，从在读改为读完／弃读结束当前记录；状态不变不新增记录。
- 开始与结束日期使用 `YYYY-MM-DD` 的日历日期，默认 iPhone 当地今天、保存前可编辑；在读的结束日期为空，已结束时必须不早于开始日期。
- 旧“读完”书只标记至少读过一次，不自动生成虚构日期；下一次在读直接是二刷，可后补首刷日期。旧书其他状态不推断阅读次数。
- 历史结果只有 `reading`／`finished`／`dropped`；一本书至多一条在读记录。总体评分保存在书籍层，状态转换不抹掉它。
- 书籍和阅读记录的联动保存必须原子化；失败或连点不能留下部分修改。删除最新记录时按设计文档回退状态，其余记录和书籍资料不变。
- 本次不做每次阅读感想、摘记关联、阅读时长、连载完结状态、备份、统计或 AI；不新增原生依赖。
- Windows PowerShell 使用 `npm.cmd`／`npx.cmd`。先跑相关测试，最后运行一次完整测试、`npx.cmd tsc --noEmit` 和 `npx.cmd expo lint --no-cache`；不重复跑 Expo Doctor 或 iOS 导出，除非新增依赖或出现打包问题。
- 在 `codex/reading-history` 独立工作区实施；不自动合并或推送 GitHub。iPhone Expo Go 验收须用户完成。

## 重点复核

1. v4 已读旧书升级后没有虚构日期，但第一次重新在读编号为 2，重复迁移不变：任务 1、2 测试。
2. 2026-02-30、空白日期和结束早于开始被拒绝，填写内容保留：任务 1、2、4 测试。
3. 旧“在读”书没有活动记录时改“读完”，必须建立完整首刷而非更新不存在的记录：任务 2 测试。
4. 保存中途失败及双击保存不得产生多条阅读记录，书籍状态也不得先行变化：任务 2、4 测试。
5. 删除最新记录、历史中间记录及旧已读占位并存时，状态和序号处理正确：任务 3、5 测试。

---

## 文件分工

- `src/storage/database.ts`：v5 迁移；`tests/books/migration.test.ts`：旧库与重复迁移。
- `src/books/readingDates.ts`：当地日期与严格校验；`src/books/types.ts`、`validation.ts`：阅读输入与记录类型。
- `src/books/sqliteRepository.ts`：新建和改状态时自动维护记录；`tests/books/readingTransitions.test.ts`：状态机、事务与旧书。
- `src/books/readingHistoryRepository.ts`、`src/storage/AppProvider.tsx`：读取、补记、日期修改、删除、状态回退与界面注入；`tests/books/readingHistoryRepository.test.ts`：持久化与失败回滚。
- `src/books/ReadingDateFields.tsx`、`AddBookForm.tsx`、`BookEditForm.tsx`：日期输入与状态预览；对应表单测试。
- `src/app/book/new.tsx`、`src/app/book/[id]/edit.tsx`、`src/app/book/[id].tsx`、`src/app/book/[id]/reading/[sessionId].tsx`：表单接入、详情和阅读历史编辑路由。
- `src/books/BookDetail.tsx`、`src/books/ReadingHistoryForm.tsx`、路由测试及 `README.md`：历史展示、纠错和使用说明。

### Task 1: 无损迁移与日期规则

**文件：** 修改 `src/storage/database.ts`、`tests/books/migration.test.ts`；新建 `src/books/readingDates.ts`、`tests/books/readingDates.test.ts`。

**接口：** `migrateDatabase(db: Database): Promise<void>` 保持；升级后 `PRAGMA user_version = 5`。`books.legacy_read_count INTEGER NOT NULL DEFAULT 0`；`reading_sessions(id, book_id, ordinal, started_on, ended_on, outcome)` 用书籍外键及 `(book_id, ordinal)` 唯一约束，`outcome` 只许 `reading`／`finished`／`dropped`，每本书至多一个 `reading`。`todayLocalDate(now?: Date): string`、`normalizeReadingDates(status: BookStatus, startedOn: string, endedOn?: string | null): { startedOn: string; endedOn: string | null }`。

- [x] **步骤 1：编写会失败的测试。** v4“读完”书迁移后 `legacy_read_count=1`、无阅读记录；其他旧状态为 0；v1～v4、新库及重复迁移均保留 ID、评分、标签、主角。日期测试断言当地日期而非 UTC 日期、闰年合法、无效日及倒序日期拒绝。
- [x] **步骤 2：运行针对性测试，确认因新功能缺失而失败。** `npm.cmd test -- --runInBand tests/books/migration.test.ts tests/books/readingDates.test.ts`。
- [x] **步骤 3：实现迁移与日期函数。** 按现有 `PRAGMA table_info` 风格幂等添加列；仅首次从 v4 或更早升级时为现有读完书设置标记。新表使用外键和部分唯一索引；日期按当地年月日生成并严格校验。
- [x] **步骤 4：重新运行上述测试。** 预期全部通过。
- [x] **步骤 5：提交。** 提交信息 `feat: migrate reading history schema`。

### Task 2: 状态变化自动创建和结束阅读

**文件：** 修改 `src/books/types.ts`、`validation.ts`、`sqliteRepository.ts`、相关测试数据；新建 `tests/books/readingTransitions.test.ts`。

**接口：** `ReadingSession = { id: string; bookId: string; ordinal: number; startedOn: string; endedOn: string | null; outcome: 'reading' | 'finished' | 'dropped' }`；`Book.legacyReadCount: number`；`BookInput`／`BookEditInput` 增加可选 `readingDates?: { startedOn: string; endedOn?: string | null }`。`SqliteBookRepository` 现有构造参数保持兼容，追加可选 `todayFactory: () => string = todayLocalDate`。`create`／`update` 的返回签名不变。

- [x] **步骤 1：编写会失败的真实 SQLite 测试。** 新建四种状态、从非在读到在读、在读到读完／弃读、无活动记录直接到读完／弃读、状态不变、旧读完书二刷、旧在读书补建首刷；断言序号、日期、结果、评分保留及重新读取一致。注入阅读表写入错误，断言状态与历史一同回滚。
- [x] **步骤 2：运行针对性测试，确认失败。** `npm.cmd test -- --runInBand tests/books/readingTransitions.test.ts`。
- [x] **步骤 3：在书籍事务内实现转换。** 读取旧状态和当前活动记录；按设计文档增改或取消记录；记录序号取现存最大序号与旧书标记的较大值再加一；省略日期时使用 `todayFactory`。从在读改回想读时只删除活动记录；不改变既往完成记录。
- [x] **步骤 4：运行上述测试及现有书籍仓储测试。** `npm.cmd test -- --runInBand tests/books/readingTransitions.test.ts tests/books/sqliteRepository.test.ts tests/books/editBook.test.ts`；`npx.cmd tsc --noEmit`，预期通过。
- [x] **步骤 5：提交。** 提交信息 `feat: track reading sessions from status changes`。

### Task 3: 阅读历史的补记、修正与删除

**文件：** 新建 `src/books/readingHistoryRepository.ts`、`tests/books/readingHistoryRepository.test.ts`；修改 `src/storage/AppProvider.tsx`。

**接口：** `SqliteReadingHistoryRepository(db: Database, idFactory?: () => string)` 提供 `list(bookId: string): Promise<ReadingSession[]>`、`backfillFirst(bookId: string, startedOn: string, endedOn: string): Promise<ReadingSession>`、`updateDates(bookId: string, sessionId: string, startedOn: string, endedOn: string | null): Promise<void>`、`delete(bookId: string, sessionId: string): Promise<void>`；`backfillFirst` 仅用于旧读完占位，已有首刷时拒绝。`useReadingHistory()` 从 `AppProvider` 返回同一仓储实例，供任务 4 和 5 的路由使用。

- [x] **步骤 1：编写会失败的测试。** 按序读出多次记录；补记首刷后原二刷序号不变；拒绝对非旧书或已有首刷重复补记；改日期保留 ID／序号并校验结果所需结束日期；删除中间记录不改状态；删除最新记录回退到上次结果、旧首刷占位或想读；注入失败不留下部分修改。
- [x] **步骤 2：运行针对性测试，确认失败。** `npm.cmd test -- --runInBand tests/books/readingHistoryRepository.test.ts`。
- [x] **步骤 3：实现仓储方法。** 使用参数绑定和独占事务；读写前确认书籍与记录属于同一书；删除后只在最新记录原本对应当前状态时调整书籍状态与 `updated_at`。
- [x] **步骤 4：重新运行测试。** 上述针对性测试与 `npx.cmd tsc --noEmit` 均通过。
- [x] **步骤 5：提交。** 提交信息 `feat: edit and correct reading history`。

### Task 4: 添加与编辑表单的日期预览

**文件：** 新建 `src/books/ReadingDateFields.tsx`；修改 `src/books/AddBookForm.tsx`、`src/books/BookEditForm.tsx`、`src/app/book/[id]/edit.tsx`；修改 `tests/books/addBook.test.tsx`、`tests/books/BookEditForm.test.tsx`、`tests/books/bookRoutes.test.tsx`。

**接口：** `ReadingDateFields({ startedOn, endedOn, showEnd, onStartChange, onEndChange }: ...)` 使用可访问的 `YYYY-MM-DD` 文本输入，不新增原生依赖。编辑表单追加 `sessions: ReadingSession[]`；仅在状态变化时提交 `readingDates`，新建非想读状态提交对应日期。编辑路由先读取书籍和 `readingHistory.list(id)` 再显示表单。

- [x] **步骤 1：编写会失败的表单和路由测试。** 新建读完即显示两个当地今天的可编辑日期；在读仅开始日期，想读无日期；读完→在读预览二刷，旧读完书也为二刷；在读→弃读预填活动记录开始日期与今天结束日期；状态不变不发送日期；无效日期不保存并保留输入；在读→想读的确认取消不保存、确认后只保存一次；失败可重试。
- [x] **步骤 2：运行针对性测试，确认失败。** `npm.cmd test -- --runInBand tests/books/addBook.test.tsx tests/books/BookEditForm.test.tsx tests/books/bookRoutes.test.tsx`。
- [x] **步骤 3：实现日期控件与表单。** 保持只填书名的想读快捷路径、已有键盘避让和评分规则。确认操作使用 React Native `Alert`；提交前复用日期标准化；路由加载错误可重试。
- [x] **步骤 4：重新运行上述测试及 `npx.cmd tsc --noEmit`。** 预期通过。
- [x] **步骤 5：提交。** 提交信息 `feat: enter dates through book status forms`。

### Task 5: 详情历史与纠错页面

**文件：** 修改 `src/books/BookDetail.tsx`、`src/app/book/[id].tsx`、`src/app/_layout.tsx`、`README.md`；新建 `src/books/ReadingHistoryForm.tsx`、`src/app/book/[id]/reading/[sessionId].tsx`；修改 `tests/books/BookDetail.test.tsx`、`tests/books/bookRoutes.test.tsx`。

**接口：** `BookDetail({ book, sessions }: { book: Book; sessions: ReadingSession[] })` 展示完整历史和旧已读占位；纠错路由的 `sessionId='first'` 表示补记旧首刷，其他值表示已有记录。路由调用 `readingHistory.updateDates`／`backfillFirst`／`delete`，删除先确认，成功后返回详情。

- [x] **步骤 1：编写会失败的详情与路由测试。** 顺序、结果、日期、在读中、旧首刷占位、空历史与“编辑日期”入口；补记首刷可保存改过的日期；已有记录可修改或确认删除；取消删除和保存失败不误报成功；书架卡片不出现次数。
- [x] **步骤 2：运行针对性测试，确认失败。** `npm.cmd test -- --runInBand tests/books/BookDetail.test.tsx tests/books/bookRoutes.test.tsx`。
- [x] **步骤 3：实现历史区域与纠错页面。** 详情默认展开全部历史；编辑页复用日期控件，异常时保留输入；完成后重新读取本地记录。更新 `README.md` 写明自动记录、旧书占位和数据风险。
- [x] **步骤 4：运行最后一次完整检查。** `npm.cmd test -- --runInBand`、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`git diff --check`；记录实际结果。若引入依赖或打包异常，再追加 Expo Doctor／iOS 导出。
- [x] **步骤 5：提交。** 提交信息 `feat: show and correct reading history`。
- [ ] **步骤 6：请用户用 iPhone 验收。** 新建读完书并改首刷日期，改在读生成二刷、改弃读结束；检查评分保留和旧已读书可直接二刷。未得到用户反馈前标记“待实机验证”。

## 执行交接

按红灯测试、最小实现、绿灯测试和本地提交的顺序逐项完成。用户已明确要求文档写好后直接开发，采用当前会话原生执行，不再等待计划二次确认；未经明确要求不合并或推送 GitHub。
