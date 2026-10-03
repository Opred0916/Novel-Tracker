# 旧记录文字导入 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL：使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 逐项实施；用复选框（`- [ ]`）记录进度。实施前同时阅读设计文档。

**Goal / 目标：** 用户可将旧清单、带字段的记录及“编号书目＋回复”的复制文字或 TXT，核对后安全追加到当前书库。

**Architecture / 架构：** 纯文本解析只产生带原文依据的临时候选；预览层负责人工修正、重复判断和最终确认；提交服务在一次 SQLite 事务中复核并写入。先扩展阅读日期、摘记来源时间和备份格式，使旧记录缺失日期时不被误写为今天。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、Expo SQLite、已安装的 Expo DocumentPicker／FileSystem、Jest、Testing Library React Native；不新增原生依赖。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-03-old-record-text-import-design.md`

## Global Constraints / 全局约束

- 仅导入用户粘贴的文字或 UTF-8 `.txt`；不抓取微博链接、不做截图 OCR、AI 解析、CSV／Excel 或联网补全。
- 三种模式固定为“每行一本书”“按记录段落”“编号书目＋后续回复”；微博复制文本若失去层级，回复进入待处理原文，不猜归属。
- 单次解码后最多 1 MiB、最多 500 个书目候选；超限报错，不截断。UTF-8 BOM、CRLF/LF、Unicode、emoji 可用。
- 批量状态默认“想读”，用户可改；序号、`top1`、点赞和评论时间不得自动成为评分、阅读次数或阅读日期。
- 未知历史日期保持未知；导入摘记的来源时间未知时不自动关联阅读次数。普通新增书的当天日期默认不变。
- 最终确认前不写书库；提交时重查重复和目标书，以一个 SQLite 独占事务全成或全退。原文件不改动。
- 疑似重复只能逐项跳过、新建独立书目，或向既有书仅追加已确认摘记；绝不覆盖现有书资料。
- 备份导出升级为格式 3，并继续读取格式 1、2；现有图片、封面、标签和关联保持完整。
- Windows PowerShell 使用 `npm.cmd`、`npx.cmd`；只跑与本功能及其数据迁移相关的测试、TypeScript 和 lint，不重复耗时的全量测试或 Expo Doctor，除非出现超出范围的回归／依赖异常。手机验收由用户进行，未做前不得声称真机通过。

## 文件分工

- `src/storage/database.ts`：v9 迁移，阅读记录日期可空，摘记添加来源日期／时间与来源标记。
- `src/books/types.ts`、`readingDates.ts`、`sqliteRepository.ts`、`readingHistoryRepository.ts`、`noteAssociation.ts`、`notesRepository.ts`：历史日期、状态转换、摘记来源时间的领域规则。
- `src/books/BookDetail.tsx`、`ReadingHistoryForm.tsx`、`ReadingDateFields.tsx`、`NotesSection.tsx`、`NoteForm.tsx`：日期未知的显示与补填；普通录入仍保持原流程。
- `src/backup/backupTypes.ts`、`backupValidation.ts`、`backupRepository.ts`、`backupArchive.ts`、`backupService.ts`：格式 3 往返与旧格式兼容。
- `src/import/importTypes.ts`：候选、原文片段、预览决定和结果的唯一类型定义。
- `src/import/textImportParser.ts`：严格 UTF-8 解码、三种确定性文字识别和输入上限；不访问数据库、文件或网络。
- `src/import/importReview.ts`：候选编辑后的纯校验、重复键、冲突提示、原文处理状态和确认摘要。
- `src/import/importCommitService.ts`：事务内重查重复、目标书和字段，再追加书籍、阅读记录、摘记。
- `src/import/importPlatform.ts`：Expo 文件选择与小文件字节读取；取消返回 `null`。
- `src/import/ImportSourceForm.tsx`、`ImportReviewList.tsx`：移动端输入与虚拟化候选编辑。
- `src/app/settings/import.tsx`、`src/app/settings/data.tsx`、`src/app/index.tsx`、`src/app/_layout.tsx`、`src/storage/AppProvider.tsx`：导入流程、数据管理入口和服务注入。
- `tests/import/*`、现有 `tests/books/*`、`tests/backup/*`：纯解析、迁移、提交回滚、页面和备份兼容测试。

## Review Focus

- 微博复制文本没有缩进或回复标记时，不能把一条回复错配给上一部书；任务 4 的 `textImportParser.test.ts` 固定此行为。
- 已读／弃读／在读旧记录和摘记缺日期时，不能静默填今天或错误显示“在读中”；任务 1、2 的迁移及界面测试固定此行为。
- 预览后书库发生变化、目标书被删除或同一摘记已存在时，提交不得覆盖或悄悄重复追加；任务 5、6 的测试固定此行为。
- 格式 1、2 备份恢复和格式 3 含日期未知、摘记来源时间、封面、共用图片的往返均有效；任务 3 的测试固定此行为。
- 错误编码、超过 1 MiB／500 条、隐藏回复提示、文件选择和最终确认取消，都不得留下部分导入；任务 4、6、7 的测试固定此行为。

---

### 任务 1：日期未知的阅读记录与旧库迁移

**文件：** 修改 `src/storage/database.ts`、`src/books/types.ts`、`src/books/readingDates.ts`、`src/books/sqliteRepository.ts`、`src/books/readingHistoryRepository.ts`、`src/books/noteAssociation.ts`、`src/books/BookDetail.tsx`、`src/books/ReadingHistoryForm.tsx`、`src/books/ReadingDateFields.tsx`；测试 `tests/books/migration.test.ts`、`readingTransitions.test.ts`、`readingHistoryRepository.test.ts`、`readingDates.test.ts`、`BookDetail.test.tsx`。

**Interfaces:** `ReadingSession.startedOn: string | null`、`endedOn: string | null`；新增 `normalizeHistoricalReadingDates(outcome, startedOn: string | null, endedOn: string | null)`，只供导入和补填使用；普通 `normalizeReadingDates` 保持要求完整日期。`SqliteReadingHistoryRepository.updateDates` 接受可空日期。

- [ ] **步骤 1：先写失败测试。** v8 数据库升级到 v9 后，原书 ID、阅读序号、摘记外键与图片关联不变；重复运行迁移不重复建记录；可存“读完／弃读／在读且日期未知”；已知结束日早于已知开始日被拒绝；未知日期详情显示“日期未记录”而非“在读中”。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/migration.test.ts tests/books/readingTransitions.test.ts tests/books/readingHistoryRepository.test.ts tests/books/BookDetail.test.tsx`；预期新增断言失败。
- [ ] **步骤 3：实现 v9 安全迁移。** 在同一 SQLite 连接上事务性重建 `reading_sessions` 的可空日期约束，处理 `notes` 外键引用并运行 `PRAGMA foreign_key_check`；不使用虚假的哨兵日期。同时给 `notes` 增加 `source_kind TEXT NOT NULL DEFAULT 'app'`、可空的 `original_recorded_on` 和 `original_recorded_time` 供任务 2 使用；迁移失败保留旧库。
- [ ] **步骤 4：适配领域与页面。** 导入的无开始日“在读”结束时保留未知开始日，结束日按此次用户操作选择；普通创建继续默认当地今天。阅读历史编辑页给空日期明确的“未记录／补填”状态，用户未选择时不得悄悄变为今天；仅在有真实日期时参加摘记日期匹配。
- [ ] **步骤 5：运行绿灯与类型检查。** `npm.cmd test -- --runInBand tests/books/migration.test.ts tests/books/readingTransitions.test.ts tests/books/readingHistoryRepository.test.ts tests/books/readingDates.test.ts tests/books/BookDetail.test.tsx`、`npx.cmd tsc --noEmit`；预期全通过。
- [ ] **步骤 6：提交。** `git add src/storage/database.ts src/books tests/books`；`git commit -m "feat: preserve unknown historical reading dates"`。

### 任务 2：摘记原记录时间与自动关联

**文件：** 修改 `src/books/types.ts`、`src/books/notesRepository.ts`、`src/books/NotesSection.tsx`、`src/books/NoteForm.tsx`；创建 `src/books/OptionalRecordedDateField.tsx`；测试 `tests/books/notesRepository.test.ts`、`noteAssociation.test.ts`、`NoteForm.test.tsx`、`BookDetail.test.tsx`。

**Interfaces:** `Note.sourceKind: 'app' | 'import'`、`originalRecordedOn: string | null`、`originalRecordedTime: string | null`；原时间为当地日期 `YYYY-MM-DD` 与可选 `HH:mm`，不凭空补时区。普通 `createNote()` 写 `sourceKind='app'`；导入服务写 `'import'`。`SqliteNotesRepository.updateNote` 可修改导入摘记的原记录日期／时间。

- [ ] **步骤 1：先写失败测试。** 现有 App 摘记仍按 `createdAt` 关联；导入摘记原时间为空时显示“记录时间未注明”且关联为 `null`；补上完整日期后才关联；编辑阅读日期可重新计算；原时间晚于／早于阅读范围时不关联；无效 `HH:mm` 和空正文仍拒绝。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/notesRepository.test.ts tests/books/noteAssociation.test.ts tests/books/NoteForm.test.tsx`；预期新增断言失败。
- [ ] **步骤 3：实现来源元数据。** 读取任务 1 的 v9 列；App 原有摘记迁移为 `sourceKind='app'`，保持原 `created_at`、`updated_at` 和图片关联。导入摘记用确认后的原记录日期关联；不把导入当天当作原时间。
- [ ] **步骤 4：实现显示和补填。** `NotesSection` 对导入摘记显示来源日期或“记录时间未注明”；`NoteForm` 编辑导入摘记时提供可清空日期控件，iPhone 继续用现有滑轮风格，普通新增摘记无需新增必填项。
- [ ] **步骤 5：运行绿灯与类型检查。** `npm.cmd test -- --runInBand tests/books/notesRepository.test.ts tests/books/noteAssociation.test.ts tests/books/NoteForm.test.tsx`、`npx.cmd tsc --noEmit`；预期全通过。
- [ ] **步骤 6：提交。** `git add src/books tests/books`；`git commit -m "feat: distinguish imported note dates"`。

### 任务 3：备份格式 3 与旧格式兼容

**文件：** 修改 `src/backup/backupTypes.ts`、`backupValidation.ts`、`backupRepository.ts`、`backupArchive.ts`、`backupService.ts`、`tests/backup/backupFixtures.ts`、`backupValidation.test.ts`、`backupRepository.test.ts`、`backupArchive.test.ts`、`backupService.test.ts`。

**Interfaces:** `CURRENT_BACKUP_FORMAT_VERSION = 3`；新增 `BackupManifestV3`，其阅读记录日期可空，摘记包含 `sourceKind`、`originalRecordedOn`、`originalRecordedTime`。`validateBackupManifest(input: unknown): ValidatedBackupManifest` 接受 1／2／3 并输出供恢复使用的规范化集合及原格式版本；旧版缺少的来源字段规范为 App 摘记语义，对旧版阅读日期仍作原有严格校验。

- [ ] **步骤 1：先写失败测试。** v3 含日期未知、多次阅读、导入摘记、封面与共用图片的导出→恢复保真；v1、v2 fixture 仍恢复；v3 无效日期、错误来源字段和摘记关联外键被拒绝；v3 封面图片损坏仍被拒绝。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/backup/backupValidation.test.ts tests/backup/backupRepository.test.ts tests/backup/backupArchive.test.ts`；预期 v3 断言失败。
- [ ] **步骤 3：实现版本化类型、验证和仓储。** 新导出固定 v3；保留 v1／v2 读取，恢复时为旧摘记补 `sourceKind='app'` 和空来源时间；归档层对 v2、v3 都校验封面图片，不能沿用当前仅检查版本 2 的判断。已有归档大小与路径限制不变。
- [ ] **步骤 4：运行绿灯与类型检查。** `npm.cmd test -- --runInBand tests/backup`、`npx.cmd tsc --noEmit`；预期全通过。
- [ ] **步骤 5：提交。** `git add src/backup tests/backup`；`git commit -m "feat: back up imported history metadata"`。

### 任务 4：输入限制与三种纯文字解析

**文件：** 创建 `src/import/importTypes.ts`、`src/import/textImportParser.ts`、`tests/import/textImportParser.test.ts`、`tests/import/fixtures/weibo-numbered-replies.txt`（从用户截图匿名改写，不放用户名或原始截图）。

**Interfaces:** `ImportMode = 'lines' | 'blocks' | 'numbered_replies'`；`ImportSessionDraft { ordinal: number; outcome: 'reading' | 'finished' | 'dropped'; startedOn: string | null; endedOn: string | null }`；`ImportNoteDraft { id: string; body: string; originalRecordedOn: string | null; originalRecordedTime: string | null; sourceText: string }`；`ImportCandidate { id, sourceLine, sourceText, title, author, protagonists, status, ratingHalfStars, bookType, tagIds, sessions: ImportSessionDraft[], notes: ImportNoteDraft[] }`；`ImportFragment { id, sourceLine, text, reason }`；`ImportParseResult { candidates: ImportCandidate[]; fragments: ImportFragment[]; warnings: string[] }`；`parseTextImport(text: string, mode: ImportMode, defaultStatus: BookStatus): ImportParseResult`；`decodeImportUtf8(bytes: Uint8Array): string`；`MAX_IMPORT_BYTES = 1_048_576`、`MAX_IMPORT_CANDIDATES = 500`。

- [ ] **步骤 1：先写失败测试。** 三模式分别识别书名、明确字段、多个摘记与清楚标记的多次阅读；编号 `144残次品` 的 `144` 只作来源序号，`top1` 只作回复文字；`共4条回复` 给出隐藏内容警告，用户名／地区／点赞不作书籍字段；没有层级的回复留为 `ImportFragment`。
- [ ] **步骤 2：补输入边界测试。** UTF-8 BOM、CRLF/LF、英文、emoji 与完整年月日可用；两位数年份待确认；独立书名 `1984` 不误删为序号，只有带分隔符的列表数字才移除；只有 URL 不成书名；无效 UTF-8、空文本、超过 1 MiB／500 候选报明确错误；未知段落及行内余文可见、不丢失。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/import/textImportParser.test.ts`；预期模块不存在。
- [ ] **步骤 4：实现纯解析器。** 按模式决定书名边界；仅将明确字段写入候选，状态默认值来自参数；保留来源行号、原文、警告与未归属片段。UTF-8 严格解码，不用替换字符掩盖坏字节；不读取网页、文件或 SQLite。
- [ ] **步骤 5：运行绿灯与类型检查。** `npm.cmd test -- --runInBand tests/import/textImportParser.test.ts`、`npx.cmd tsc --noEmit`；预期全通过。
- [ ] **步骤 6：提交。** `git add src/import/importTypes.ts src/import/textImportParser.ts tests/import`；`git commit -m "feat: parse old text records into drafts"`。

### 任务 5：预览校验与重复提示

**文件：** 创建 `src/import/importReview.ts`、`tests/import/importReview.test.ts`。

**Interfaces:** `ImportReviewItem { candidate: ImportCandidate; action: 'create' | 'skip' | 'append_notes'; targetBookId: string | null; acknowledgedDuplicateBookIds: string[]; acknowledgedDuplicateNoteIds: string[] }`；`ImportReview { items: ImportReviewItem[]; fragments: ImportFragment[]; ignoredFragmentIds: string[] }`。`ExistingBookSummary { id: string; title: string; author: string | null }`、`ExistingNoteSummary { id: string; bookId: string; body: string }`、`ImportSummary { createdBooks: number; createdNotes: number; appendedNotes: number; skippedItems: number }`。产出 `normalizeDuplicateKey(title: string): string`、`findImportDuplicates(review: ImportReview, existingBooks: ExistingBookSummary[], existingNotes: ExistingNoteSummary[]): DuplicateHint[]`、`validateImportReview(review: ImportReview): ImportValidationIssue[]`、`summarizeImport(review: ImportReview): ImportSummary`。

- [ ] **步骤 1：先写失败测试。** Unicode 规范化、空白折叠与英文大小写折叠命中重复；有意义标点和不同 ID 不自动合并；同批重复也提示；同书相同摘记正文需再确认，未知原文未明确忽略不能进入最终确认。
- [ ] **步骤 2：补字段测试。** 空书名、非读完评分、倒序或无效日期、重复阅读序号、在读记录不是最后一条、追加目标无摘记均报到具体候选；已读整批默认状态产生一次日期未知记录，不生成今天日期。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/import/importReview.test.ts`；预期模块不存在。
- [ ] **步骤 4：实现纯预览规则。** 仅计算提示和最终操作，不写库；书名规范化用 Unicode NFKC、`trim`、连续空白折叠及英文小写，不删标点；作者只增强提示，不决定自动合并。
- [ ] **步骤 5：运行绿灯与类型检查。** `npm.cmd test -- --runInBand tests/import/importReview.test.ts`、`npx.cmd tsc --noEmit`；预期全通过。
- [ ] **步骤 6：提交。** `git add src/import/importReview.ts tests/import/importReview.test.ts`；`git commit -m "feat: review imported books and duplicates"`。

### 任务 6：原子追加服务

**文件：** 创建 `src/import/importCommitService.ts`、`tests/import/importCommitService.test.ts`；必要时修改 `tests/helpers/inMemoryDatabase.ts` 以注入事务故障。

**Interfaces:** `ImportCommitService(db: Database, idFactory?: () => string)`；`getDuplicateHints(review): Promise<DuplicateHint[]>`；`commit(review: ImportReview): Promise<ImportSummary>`；新增 `ImportConflictError` 表示预览后出现未确认重复、追加目标已删除或摘记冲突。

- [ ] **步骤 1：先写失败测试。** 新增书保留状态、总体评分、标签、主角、已确认的多次阅读及多条摘记；追加已有书只写摘记不改作者／状态／评分／阅读历史；再导入相同文本触发重复提醒。
- [ ] **步骤 2：补并发与失败测试。** 预览后新增同名书、删除追加目标、增加相同摘记、使用无效标签 ID、事务中段故障和双击提交；都不留下部分新书／摘记，且原书库内容逐项不变。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/import/importCommitService.test.ts`；预期服务不存在。
- [ ] **步骤 4：实现事务提交。** 在独占事务内部重跑任务 5 的校验与重复查询；只使用用户确认的动作。直接写入导入记录，不能调用会另起事务、默认生成今天日期的普通 `BookRepository.create()`；为每条书、阅读记录和摘记生成稳定新 ID，并防止同一服务实例的重复提交。
- [ ] **步骤 5：运行绿灯与类型检查。** `npm.cmd test -- --runInBand tests/import/importCommitService.test.ts tests/books/sqliteRepository.test.ts tests/books/notesRepository.test.ts`、`npx.cmd tsc --noEmit`；预期全通过。
- [ ] **步骤 6：提交。** `git add src/import/importCommitService.ts tests/import tests/helpers/inMemoryDatabase.ts`；`git commit -m "feat: atomically import reviewed records"`。

### 任务 7：TXT 选择、手机预览与最终确认

**文件：** 创建 `src/import/importPlatform.ts`、`src/import/ImportSourceForm.tsx`、`src/import/ImportReviewList.tsx`、`src/app/settings/import.tsx`、`src/app/settings/data.tsx`、`tests/import/importPage.test.tsx`；修改 `src/storage/AppProvider.tsx`、`src/app/_layout.tsx`、`src/app/index.tsx`、`tests/books/bookRoutes.test.tsx`。

**Interfaces:** `pickImportTxt(): Promise<{ name: string; bytes: Uint8Array } | null>` 使用 `getDocumentAsync({ copyToCacheDirectory: true, multiple: false })` 和 Expo FileSystem `File.bytes()`；先检查文件大小再读，取消返回 `null`。`useImportCommitService(): ImportCommitService` 复用当前 SQLite 连接。路由为 `/settings/data` 与 `/settings/import`。

- [ ] **步骤 1：先写失败页面测试。** 空／非空书架可进入数据管理和导入页；粘贴与 TXT 进同一预览；候选的作者／主角／类型／标签／状态／评分／日期／摘记可编辑，并可拆分／合并候选、逐项跳过或追加；零候选时可手动建候选。原文片段处理、隐藏回复提示、确认数量、返回不写入；键盘弹起时仍可滚到后续字段。
- [ ] **步骤 2：补文件与错误测试。** 文件选择取消保留原文字；UTF-8 错误、扩展名不符、超限和读取失败有提示且不清空草稿；预览中取消、最终确认取消不调用 `commit()`；提交中按钮禁用；冲突后回到预览并保留编辑。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/import/importPage.test.tsx tests/books/bookRoutes.test.tsx`；预期页面或服务 hook 不存在。
- [ ] **步骤 4：实现文件适配器与页面。** 文件类型同时看名称与实际 UTF-8 内容，不依赖 MIME 一项；只读不写原 TXT。预览用 `FlatList`，表单可滚动并适配键盘；重复提醒与待处理原文不可藏在折叠区。最终确认显示新增、追加、跳过数量和原文未处理数量。
- [ ] **步骤 5：接入 Provider、路由和书架入口。** “数据管理”同时保留现有备份／恢复入口，并区分“追加旧记录”与“整体替换”；导入成功刷新书架搜索结果，失败保留预览。
- [ ] **步骤 6：运行绿灯与类型检查。** `npm.cmd test -- --runInBand tests/import/importPage.test.tsx tests/books/bookRoutes.test.tsx tests/backup/backupPage.test.tsx`、`npx.cmd tsc --noEmit`；预期全通过。
- [ ] **步骤 7：提交。** `git add src/import src/app/settings src/app/index.tsx src/app/_layout.tsx src/storage/AppProvider.tsx tests/import tests/books/bookRoutes.test.tsx`；`git commit -m "feat: review and import old text records"`。

### 任务 8：完整验证与真机交接

**文件：** 修改 `README.md`；只修复本功能验收发现问题所必需的 `src/*` 与 `tests/*`。

- [ ] **步骤 1：更新 README。** 说明文字／TXT 导入会追加到现有书库、先预览再确认、微博链接和截图暂不自动识别，以及整库备份恢复的不同；不要把未实测的微博复制格式写成已支持。
- [ ] **步骤 2：运行最后一次验证。** `npm.cmd test -- --runInBand tests/import tests/books/migration.test.ts tests/books/readingTransitions.test.ts tests/books/readingHistoryRepository.test.ts tests/books/notesRepository.test.ts tests/books/bookRoutes.test.tsx tests/backup`、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`git diff --check`；预期相关测试、类型、lint、空白字符检查全通过。未新增依赖时不重复运行 Expo Doctor。
- [ ] **步骤 3：准备 iPhone Expo Go 清单。** 用书名清单、带字段记录和匿名化的“编号书目＋回复”文字各导入一次；核对状态默认、回复归属、日期未知、重复处理、取消、书架搜索与备份。微博真实复制文本只有取得并核对后才标注支持程度。
- [ ] **步骤 4：根据真机发现的问题先补失败测试再修复。** 仅重跑相关测试；最终修复后重复步骤 2。没有用户实机结果时记为“待验收”，不得写“真机通过”。
- [ ] **步骤 5：提交收尾。** 有变更才执行 `git add README.md src tests` 和 `git commit -m "test: verify old-record text import"`；不创建空提交，不在未经用户要求时合并或推送。

**SDK 57 依据：** [Expo DocumentPicker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/) 说明 `copyToCacheDirectory: true` 可使所选文件立即供 FileSystem 读取；[Expo FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/) 提供 `File.bytes()`。实施任务 7 前按 `AGENTS.md` 再核对当前版本文档和真机行为。
