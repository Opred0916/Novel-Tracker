# 资料完善、表格导入与书库概览 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL：使用 `superpowers:executing-plans`（本轮连续实施）或 `superpowers:subagent-driven-development` 逐项执行；用复选框（`- [ ]`）记录进度。实施前阅读设计文档。

**Goal / 目标：** 在一轮开发中交付可选想看理由与平台、CSV／XLSX 旧书单导入、只读书库概览，并保持旧数据和导出文件兼容。

**Architecture / 架构：** 先给书籍模型增加两项可空字段并升级备份和开放导出；再把 CSV／XLSX 解析成带行号的表格，由用户确认列对应和问题行，最后复用现有导入预览及原子提交。概览通过独立只读查询统计书籍与有确切结束日期的已读书，不保存派生数据。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、Expo SQLite、已安装的 `expo-document-picker`／`expo-file-system`／`fflate`、纯 JavaScript SheetJS Community Edition、Jest。Windows PowerShell 使用 `npm.cmd`／`npx.cmd`。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-03-library-enrichment-batch-design.md`

## Global Constraints / 全局约束

- 三项按顺序交付：资料字段与导出兼容 → 表格导入 → 概览；任一项不得把旧记录未知日期改成今天。
- `whyWantToRead` 和 `platform` 可空，状态变化保留理由，书架卡片与现有关键词搜索不增加字段。
- 数据库从 v9 迁移到 v10；专用备份新写 v4 并能读 v1／v2／v3；开放格式 JSON 新写 v2，并更新 `books.csv` 和 `README.txt`。
- 只接受 `.csv`、`.xlsx`；CSV UTF-8，可有 BOM，支持逗号／分号／制表符；CSV 最多 1 MiB，XLSX 最多 5 MiB、最多 1,000 个 ZIP 条目、声明及实际解压总量均最多 25 MiB；单次最多 500 个非空数据行、100 列，不静默截断。
- 每个非空表格行只产生一个候选；同书多行不自动合并。用户确认列对应，未对应列须显式忽略；错误行先修正或显式跳过；提交前不写库，提交使用现有事务。
- 概览按设备本地年统计有 `ended_on` 且结果为 `finished` 的不同 `book_id`；当前状态和重复完成次数不改变这项统计，未知日期不计入。
- Expo Go 不新增原生模块；实施涉及 Expo API 前依 `AGENTS.md` 核对 SDK 57 文档。iPhone 真机验收由用户执行，未实测不得声称通过。

## 文件分工

- `src/storage/database.ts`、`src/books/types.ts`、`validation.ts`、`sqliteRepository.ts`：字段迁移、模型、校验和读写。
- `src/books/AddBookForm.tsx`、`BookEditForm.tsx`、`BookDetail.tsx`：资料输入与详情展示。
- `src/backup/*`、`src/export/*`：版本化备份恢复及开放格式导出兼容。
- `src/import/tableImportParser.ts`：CSV／XLSX 字节转有行号的表格；`src/import/tableImportMapping.ts`：列对应、行问题与 `ImportCandidate` 转换；`src/import/importPlatform.ts`：文件选择与读取。
- `src/import/TableImportSource.tsx`、`TableImportMapping.tsx`、`src/app/settings/import.tsx`、现有 `ImportReviewList.tsx`：选择文件、选表／列、逐行修正与确认。
- `src/books/libraryOverviewRepository.ts`、`src/app/settings/overview.tsx`、`src/storage/AppProvider.tsx`、`src/app/_layout.tsx`、`src/app/index.tsx`：只读概览及入口。
- 对应的 `tests/books/*`、`tests/backup/*`、`tests/export/*`、`tests/import/*`、`README.md`：契约验证与使用说明。

## Review Focus

- 旧 v1／v2／v3 备份缺新字段时要恢复为 `null`，封面、图片、阅读日期和摘记来源时间继续保真；任务 2 用跨版本往返测试固定。
- CSV 引号内换行、逗号、分号和 emoji 不能错位；公式单元格、错误编码、损坏及膨胀 XLSX 不得被当作正常书目；任务 3、4 测。
- 表格列对应不明确、书名空白或某行日期／评分无效时不能静默导入或丢行；任务 4、5 测修正／跳过路径。
- 表格预览后另一端新增同名书或删除追加目标时必须重新提醒并事务回滚；任务 5 复用并扩展现有提交测试。
- “今年读完”只数有确切当年结束日的不同书，二刷去重、跨年和未知日期正确；任务 6 测。

---

### 任务 1：可空小说资料与界面

**文件：** 修改 `src/storage/database.ts`、`src/books/types.ts`、`src/books/validation.ts`、`src/books/sqliteRepository.ts`、`src/books/AddBookForm.tsx`、`src/books/BookEditForm.tsx`、`src/books/BookDetail.tsx`；测试 `tests/books/migration.test.ts`、`addBook.test.tsx`、`editBook.test.ts`、`BookEditForm.test.tsx`、`BookDetail.test.tsx`。

**Interfaces:** `Book.whyWantToRead: string | null`、`Book.platform: string | null`；`BookInput`／`BookEditInput` 增加同名可选输入；`normalizeBookCreate()` 把缺失／空白转 `null`，`normalizeBookEdit()` 中 `undefined` 表示保持原值、显式 `null`／空白表示清除。数据库 v10 `books.why_want_to_read TEXT`、`books.platform TEXT`。

- [ ] **步骤 1：写失败测试。** 旧 v9 库迁移后原书和关系不变，新列为 `null`；只填书名可保存；理由和平台可创建、编辑、清空；编辑调用省略新字段时保留原值；状态变化不清理由；详情显示有值字段。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/migration.test.ts tests/books/addBook.test.tsx tests/books/editBook.test.ts tests/books/BookEditForm.test.tsx tests/books/BookDetail.test.tsx`，预期新增断言失败。
- [ ] **步骤 3：实现数据层。** 安全执行 v10 增列和 `PRAGMA user_version = 10`；仓储 `INSERT`／`UPDATE`／读取映射包含新字段，校验只清首尾空白、不截断正文。
- [ ] **步骤 4：实现页面。** 新建页仅想读状态展示理由，编辑页始终可编辑已有理由，平台始终可填；键盘弹出后仍可滚到保存按钮，详情仅在非空时显示。
- [ ] **步骤 5：绿灯并提交。** 运行步骤 2 的测试及 `npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`；提交 `feat: record reading motivation and platform`。

### 任务 2：备份 v4 与开放导出 v2

**文件：** 修改 `src/backup/backupTypes.ts`、`backupValidation.ts`、`backupRepository.ts`、`backupArchive.ts`、`src/export/openExportTypes.ts`、`openExportSerializer.ts`、`openExportArchive.ts` 及对应 `tests/backup/*`、`tests/export/*`。

**Interfaces:** `CURRENT_BACKUP_FORMAT_VERSION = 4`，`BackupManifestV4.books` 必含 `whyWantToRead: string | null`、`platform: string | null`；`validateBackupManifest(input)` 接受 1–4 并规范旧字段为空。`OPEN_EXPORT_FORMAT_VERSION = 2`，`createOpenExportFiles()` 消费 v4 清单。

- [ ] **步骤 1：写失败测试。** v4 新字段、封面、二刷及导入摘记能备份→恢复；v1／v2／v3 fixture 仍恢复，缺字段为 `null`；无效新字段拒绝。开放 JSON v2 与 `books.csv` 两列保真，公式前缀仅在 CSV 加安全引号。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/backup tests/export/openExportSerializer.test.ts tests/export/openExportArchive.test.ts`，预期新格式断言失败。
- [ ] **步骤 3：实现版本兼容。** 更新格式常量、类型、快照和恢复 SQL；检查旧代码对版本 `3` 的相等判断，扩成明确的兼容条件；开放 ZIP 只改变 JSON 版本、书目列和说明，保留原有图片关联与安全上限。
- [ ] **步骤 4：绿灯并提交。** 运行步骤 2 的测试、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`；提交 `feat: preserve new book details in exports`。

### 任务 3：CSV 解析与列对应纯逻辑

**文件：** 新建 `src/import/tableImportTypes.ts`、`tableImportParser.ts`、`tableImportMapping.ts`、`tests/import/tableImportParser.test.ts`、`tableImportMapping.test.ts`；修改 `src/import/importTypes.ts`、`importReview.ts`、`importCommitService.ts` 及对应测试，以保存新书字段。

**Interfaces:** `TableCell = { text: string; kind: 'text' | 'number' | 'date' | 'formula'; sourceAddress: string }`；`TableSheet = { name: string; rows: TableCell[][] }`；`TableField = 'title' | 'author' | 'protagonists' | 'status' | 'rating' | 'bookType' | 'tags' | 'startedOn' | 'endedOn' | 'note' | 'noteRecordedOn' | 'whyWantToRead' | 'platform'`；`TableColumnMapping = Partial<Record<TableField, number>>`；`TableRowIssue = { rowNumber: number; field: TableField | null; rawValue: string; message: string }`；`TableMappingOptions` 包含有无表头、默认状态、明确忽略的列与行、主角／标签分隔方式和现有标签对应；`parseCsvTable(bytes: Uint8Array, delimiter: ',' | ';' | '\t'): TableSheet`；`validateTableMapping(sheet, mapping, options): TableRowIssue[]`；`mapTableToImport(sheet, mapping, options): ImportParseResult`。只在所有问题行均已修正或明确跳过、未对应列均已确认忽略后才调用 `mapTableToImport`；不能把待处理行悄悄丢弃。`ImportCandidate` 增加 `whyWantToRead`／`platform` 可空字段。

- [ ] **步骤 1：写失败 CSV 测试。** BOM、CRLF／LF、带引号逗号／分号／换行、双引号、Unicode／emoji 正确还原行列；不合法引号、坏 UTF-8、空表、超过 1 MiB／500 行／100 列明确拒绝。
- [ ] **步骤 2：写失败映射测试。** 书名必选、同列不能映射两字段、默认表头／无表头、重复列名、未对应列显式忽略、空书名但其他列有值、无效日期／评分／状态、标签未匹配均产生带行号的问题；正常行成为带一条真实或日期未知阅读记录的候选，公式前缀 CSV 文字仍作为普通文字。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/import/tableImportParser.test.ts tests/import/tableImportMapping.test.ts`，预期模块不存在或断言失败。
- [ ] **步骤 4：实现纯逻辑。** CSV 按状态机处理引号和分隔符；映射只读确认后的列，把问题行留在表格预览，不自动跳过。未知日期为 `null`；旧 TXT 解析器只为新字段填 `null`，不改变旧规则；提交服务在事务中写新增字段。
- [ ] **步骤 5：绿灯并提交。** 运行步骤 3 加 `tests/import/importCommitService.test.ts tests/import/textImportParser.test.ts`、类型及 lint；提交 `feat: map CSV rows into import drafts`。

### 任务 4：XLSX 解析与文件安全边界

**文件：** 扩展 `src/import/tableImportParser.ts`、`src/import/importPlatform.ts`；新增 `tests/import/tableImportXlsx.test.ts`、`tests/import/tableImportPlatform.test.ts`；更新 `package.json`、`package-lock.json`。

**Interfaces:** `inspectXlsxZipLimits(bytes: Uint8Array): void` 先读 ZIP 中央目录并限额，再流式校验实际解压字节数，拒绝加密、重名／不安全路径、超过 1,000 条目或 25 MiB；`parseXlsxTables(bytes: Uint8Array): TableSheet[]`；`pickImportTable(): Promise<{ name: string; kind: 'csv' | 'xlsx'; bytes: Uint8Array } | null>`。

- [ ] **步骤 1：写失败测试。** 多工作表名称与单元格原值可读；公式单元格标为 `formula`，即使有缓存值也阻止自动映射；日期单元格在映射日期列时才转确定的完整日期；错误／加密／膨胀 ZIP、超列数与行数、`.xls` 和文件选择取消均按设计处理。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/import/tableImportXlsx.test.ts tests/import/tableImportPlatform.test.ts`，预期新接口不存在。
- [ ] **步骤 3：安装并接入纯 JS 解析器。** 用 `npx.cmd expo install` 安装固定的 SheetJS Community Edition 包（官方发布源；当前候选 `0.20.3`），锁定包与哈希；在实现前核对其许可证、SDK 57 Metro 打包和 iPhone Expo Go 加载。用现有 `fflate` 先检查 ZIP 中央目录，再流式核对实际解压上限，之后才把字节交给 SheetJS；保留 `cell.f` 等公式元数据。
- [ ] **步骤 4：实现文件适配。** Expo DocumentPicker 复制至缓存，先检查 `asset.size` 与 `File.size` 再调用 `File.bytes()`；只按 `.csv`／`.xlsx` 选择对应解析器。任何读取失败不清除当前表格预览与文字输入。
- [ ] **步骤 5：绿灯并提交。** 运行步骤 2 的测试、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`npx.cmd expo export --platform ios`；提交 `feat: read Excel workbooks for import`。

### 任务 5：列对应页面与现有导入预览接线

**文件：** 新建 `src/import/TableImportSource.tsx`、`TableImportMapping.tsx`；修改 `src/app/settings/import.tsx`、`src/import/ImportReviewList.tsx`、`src/import/ImportSourceForm.tsx`；测试 `tests/import/importPage.test.tsx`、新建 `tests/import/tableImportPage.test.tsx`。

**Interfaces:** 页面阶段 `source → sheet → mapping → review`；`TableImportMapping` 接收 `TableSheet`、`TableColumnMapping`、默认状态，返回经用户确认的 `ImportParseResult`；现有 `buildReview(result)` 和 `ImportCommitService.commit(review)` 为唯一写库入口。

- [ ] **步骤 1：写失败页面测试。** CSV／XLSX 入口、工作表与分隔符选择、前五行预览、书名列必选、未对应列确认、坏行修正／显式跳过、跳回列对应不丢草稿、最终进入现有重复检查与确认；输入平台／想看理由可修改。
- [ ] **步骤 2：补取消与回归测试。** 取消选文件不改原文字和预览；解析失败不写库；同书多行不自动拼二刷；预览后目标书变化由已有事务重新检查；既有 TXT／粘贴模式行为不变。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/import/tableImportPage.test.tsx tests/import/importPage.test.tsx`，预期入口／页面断言失败。
- [ ] **步骤 4：实现四阶段流程。** 表格预览用 `FlatList` 支撑 500 行，保留来源行号与单元格原值；映射确认后沿用 `ImportReviewList` 的逐项操作和 `commit()`，编辑态兼容键盘与小屏幕。数据管理入口继续区分追加和整体恢复。
- [ ] **步骤 5：绿灯并提交。** 运行步骤 3 加 `tests/import/importCommitService.test.ts`、类型及 lint；提交 `feat: review spreadsheet imports on phone`。

### 任务 6：只读书库概览

**文件：** 新建 `src/books/libraryOverviewRepository.ts`、`src/app/settings/overview.tsx`、`tests/books/libraryOverviewRepository.test.ts`、`tests/books/libraryOverviewPage.test.tsx`；修改 `src/storage/AppProvider.tsx`、`src/app/_layout.tsx`、`src/app/index.tsx`。

**Interfaces:** `LibraryOverview = { totalBooks: number; byStatus: Record<BookStatus, number>; finishedBooksThisYear: number; year: number }`；`SqliteLibraryOverviewRepository.getOverview(localYear: number): Promise<LibraryOverview>` 使用只读聚合查询；`useLibraryOverviewRepository()` 从 Provider 取实例。

- [ ] **步骤 1：写失败统计测试。** 四状态合计等于总数；一本书当年两次读完只计一；读完后在读仍计；去年与未知结束日、仅有 `legacy_read_count` 不计；空库为零；跨年改变传入年份后刷新。
- [ ] **步骤 2：写失败页面测试。** 书架入口可打开概览，页面有四状态与今年说明；返回后焦点刷新，查询失败可重试；不新增任何统计写表。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/books/libraryOverviewRepository.test.ts tests/books/libraryOverviewPage.test.tsx`，预期模块／路由不存在。
- [ ] **步骤 4：实现聚合与页面。** SQL 用 `COUNT(DISTINCT book_id)` 和当年 `[YYYY-01-01, 下一年-01-01)` 范围；页面聚焦时取设备本地年并重新查询，空库可进入添加／导入。
- [ ] **步骤 5：绿灯并提交。** 运行步骤 3 加 `tests/books/bookRoutes.test.tsx`、类型及 lint；提交 `feat: show local library overview`。

### 任务 7：说明、集中回归与真机交接

**文件：** 修改 `README.md`；必要修正仅限本计划涉及的文件。

- [ ] **步骤 1：更新说明。** 写清表格格式与限额、列对应／重复确认、两项资料在状态变化后保留，以及“今年读完”只数有确切日期的不同书；提醒新字段进入备份和开放 ZIP。
- [ ] **步骤 2：运行集中检查。** `npm.cmd test -- --runInBand tests/import tests/books/migration.test.ts tests/books/libraryOverviewRepository.test.ts tests/books/libraryOverviewPage.test.tsx tests/backup tests/export`，再运行 `npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`git diff --check`。若共享仓储或页面回归出现问题，再扩展对应测试；不重复运行无关全量套件。
- [ ] **步骤 3：准备 iPhone 清单。** 在 Expo Go 选含中文、多工作表、公式与日期的 XLSX，以及含引号／多行感想的 CSV；核对列对应、坏行修正、重复项、取消不写库。再新建并编辑两字段、检查备份／开放导出和概览；未取得用户结果标为待验收。
- [ ] **步骤 4：提交收尾。** 提交 `docs: explain spreadsheet import and overview`；按用户当时要求决定合并与上传，不推断真机已通过。

## SDK 与库依据

- [Expo SDK 57 DocumentPicker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/)：选中文件复制到缓存后可立即由 FileSystem 读取。
- [Expo SDK 57 FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/)：`File.size` 与 `File.bytes()` 用于先限额、后读取。
- [SheetJS React Native 示例](https://docs.sheetjs.com/docs/demos/mobile/reactnative/) 与 [官方安装说明](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)：纯 JavaScript 工作簿读取和官方发布源；落地前仍需在本项目的 Expo Go 中验证。
