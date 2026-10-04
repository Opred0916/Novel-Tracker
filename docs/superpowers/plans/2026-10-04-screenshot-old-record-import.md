# 旧记录截图导入 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the spec first.

**Goal / 目标：** 从相册批量选择旧记录截图，在设备本地识字或手工录入文字，经原图校对和现有导入预览后，把确认的书目与想法追加到书库。

**Architecture / 架构：** 截图草稿在内存中保存图片顺序、连续关系、识字状态和修正文字；独立的截图解析器只生成带来源位置的 `ImportCandidate`／`ImportFragment`。扩展现有预览页处理未归属回复、日期和候选拆合，最后仍由 `ImportCommitService` 原子提交，不存储原截图或 OCR 原文。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、`expo-image-picker`、现有 iOS Vision Expo Module、Jest；Windows PowerShell 使用 `npm.cmd`／`npx.cmd`。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-04-screenshot-old-record-import-design.md`

## Global Constraints / 全局约束

- 单批最多 20 张，仅本地图片；保留选择顺序，并允许在 App 内调整、移除和显式标记“接上一张”。改动顺序或连续关系后作废旧解析候选。
- 图片和文字不上传、不写全文日志；原图只用于本次对照，默认不入库、不进备份或开放导出，绝不删除相册原图。草稿仅在当前会话保留。
- 使用现有 `LocalImageTextRecognizer` 逐张识字；Expo Go 或无原生模块时仍可选图并手工录入，不能声称 OCR 已成功。用户修改过的文字不能被迟到的 OCR／重试覆盖。
- 书目与想法仅在用户确认后写入；编号、`top1`、用户名、点赞、地区、隐藏回复数量及微博发布时间不能冒充评分、标签或阅读日期。两位数年份须补成四位并确认，未知日期保持未知。
- 复用现有书目重复提醒、预览与 `ImportCommitService` 事务；不新增数据库表，不升级备份 v4 或开放导出 v2，不改变文字／表格导入语义。
- 截图识别后的文字总量不超过 1 MiB、候选不超过 500；超过时提示分批导入，不截断、不部分提交。候选及片段必须能回看“第几张、哪一行”。
- 不修改生成的根目录 `ios/`／`android/`。修改 Expo API 前核对 `expo` 主版本及 SDK 57 对应文档。仅运行与改动相关的定向测试，收尾再做一次类型检查、lint 和必要回归；iPhone OCR 成功须由专用开发版实测，未实测要明确标注。

## Review Focus

- 同一批选图含相同图片、用户取消选择、调整顺序或移除一张时，旧候选不能继续指向错误的图；任务 1、4 测试覆盖。
- OCR 运行时用户改了文字、取消剩余识别或重试某张图时，异步旧结果不能覆盖手工修改；任务 2 测试覆盖。
- 微博界面文字、`144残次品`、`top1`、`共4条回复` 混在一起时，不生成假书、假评分或假回复；任务 3 测试覆盖。
- 两位数年份、跨截图续接及模糊回复归属不能自动生成确定日期或附到相邻书；任务 3、4 测试覆盖。
- 未处理片段、重复书／摘记、目标书被删除或提交中途失败时，必须提示或回滚且保留预览草稿；任务 4、5 测试覆盖。

---

## 文件分工

- 新建 `src/import/screenshotImportPlatform.ts`：相册多选适配；新建 `src/import/screenshotImportDraft.ts`：截图顺序、连接关系、文字编辑和 OCR 版本号的纯状态操作。
- 新建 `src/import/screenshotImportOcr.ts`：串行调用现有本地 OCR；新建 `src/import/ScreenshotImportSource.tsx`：图片与文字的可滚动对照界面。
- 新建 `src/import/screenshotImportParser.ts`：按用户选的格式解析已修正文字，保留每条候选／片段的图片及行号，并保守处理微博回复和时间。
- 修改 `src/import/importTypes.ts`、`importReview.ts`，新建 `src/import/importReviewActions.ts`：草稿来源定位、片段处置、想法移动和候选拆合；修改 `ImportReviewList.tsx` 提供相应手机交互。
- 修改 `src/import/ImportSourceForm.tsx`、`src/app/settings/import.tsx` 接入截图步骤，修改 `README.md` 说明 Expo Go 手工路径和专用开发版限制。现有 `ImportCommitService` 除验证接线外不承担 OCR 或图片处理。

### 任务 1：多图选择与可编辑草稿

**文件：** 新建 `src/import/screenshotImportPlatform.ts`、`screenshotImportDraft.ts`、`tests/import/screenshotImportDraft.test.ts`、`tests/import/screenshotImportPlatform.test.ts`。

**Interfaces:** `pickImportScreenshots(): Promise<string[] | null>`、`cleanupImportScreenshotCopies(uris: string[]): Promise<void>`；`ScreenshotPageDraft = { id: string; uri: string; text: string; ocrState: 'pending' | 'recognized' | 'empty' | 'failed' | 'unavailable' | 'manual'; edited: boolean; continuesPrevious: boolean; revision: number }`；`ScreenshotImportDraft = { pages: ScreenshotPageDraft[]; parseRevision: number }`。纯函数为 `createScreenshotDraft(uris: string[], idFactory: () => string): ScreenshotImportDraft`、`moveScreenshot(draft: ScreenshotImportDraft, from: number, to: number): ScreenshotImportDraft`、`removeScreenshot(draft: ScreenshotImportDraft, pageId: string): ScreenshotImportDraft`、`updateScreenshotText(draft: ScreenshotImportDraft, pageId: string, text: string): ScreenshotImportDraft`、`setScreenshotContinuation(draft: ScreenshotImportDraft, pageId: string, value: boolean): ScreenshotImportDraft`；顺序、连续关系或文字变化时递增 `parseRevision`，第一页不能设为续接。

- [ ] **步骤 1：写失败测试。** `pickImportScreenshots` 传 `mediaTypes:['images']`、`allowsMultipleSelection:true`、`orderedSelection:true`、`selectionLimit:20`，取消返回 `null`；相册拒绝访问给出明确提示，21 张结果拒绝而不截断。`createScreenshotDraft` 保持 URI 顺序且重复 URI 仍有不同 ID；移动／移除／改文字／改变续接均递增 `parseRevision`，新首图不续接；取消选图不替换旧草稿。`cleanupImportScreenshotCopies` 仅尝试删除属于本 App 缓存目录的临时文件，不触碰相册或其他路径。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/import/screenshotImportDraft.test.ts tests/import/screenshotImportPlatform.test.ts`；预期新模块缺失或断言失败。
- [ ] **步骤 3：实现选择器与纯草稿操作。** 只返回所选本地 URI，不请求 Base64，不复制原图；用选图器和返回结果双重限制 20 张。纯草稿函数不访问数据库或相册文件系统；本 App 临时缓存的清理交给平台适配器，失败只记录可重试类别，不暴露路径或原文。
- [ ] **步骤 4：运行绿灯。** 重跑步骤 2；预期全通过。
- [ ] **步骤 5：提交。** 只暂存本任务文件并提交 `feat: prepare ordered screenshot import drafts`。

### 任务 2：逐张本地识字与原图校对

**文件：** 新建 `src/import/screenshotImportOcr.ts`、`ScreenshotImportSource.tsx`、`tests/import/screenshotImportOcr.test.ts`、`tests/import/screenshotImportSource.test.tsx`；扩展 `screenshotImportDraft.ts`。

**Interfaces:** `recognizeScreenshotBatch(pages: ScreenshotPageDraft[], recognizer: LocalImageTextRecognizer, onResult: (pageId: string, revision: number, result: { text?: string; error?: string }) => void, shouldStop: () => boolean): Promise<void>`；`applyScreenshotOcrResult(draft: ScreenshotImportDraft, pageId: string, revision: number, result: { text?: string; error?: string }): ScreenshotImportDraft` 仅在页仍存在、`revision` 未变且 `edited=false` 时写入并递增 `parseRevision`。`ScreenshotImportSource` 的 props 为 `{ draft, done, total, onPick, onMove, onRemove, onRetry, onTextChange, onContinuationChange, onParse }`；操作回调只更新草稿或触发任务 5 的流程，不写库。

- [ ] **步骤 1：写失败测试。** 两张图按顺序逐个调用 `recognize(uri)`，第二张失败仍保留第一张文字；`shouldStop()` 后不开始下一张；无模块时页面显示手工输入说明且可编辑。先手改文字再收到旧结果，`applyScreenshotOcrResult` 不覆盖；重试时手改文字须先经明确确认，不能静默替换。
- [ ] **步骤 2：补界面测试。** 显示图片编号、缩略图、识别状态及可滚动多行输入框；上移／下移、删除和“接上一张”回调可用；取消选图保留已有文本。单图失败显示重试与手工输入，不阻止其他图继续。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/import/screenshotImportOcr.test.ts tests/import/screenshotImportSource.test.tsx`；预期新模块或组件缺失。
- [ ] **步骤 4：实现串行 OCR 与对照界面。** 用已有 `getLocalImageTextRecognizer()`，每张保留调用时 `revision`；图片仍在草稿且未编辑时才应用结果。页面不请求网络、不把图片复制进书籍资产；识别空白和失败分别显示。
- [ ] **步骤 5：运行绿灯。** 重跑步骤 3；预期全通过。
- [ ] **步骤 6：提交。** 只暂存本任务文件并提交 `feat: review screenshots with local OCR or manual text`。

### 任务 3：保守解析并追溯每张图

**文件：** 新建 `src/import/screenshotImportParser.ts`、`tests/import/screenshotImportParser.test.ts`、匿名化测试文字 `tests/import/fixtures/weibo-screenshot-ocr.txt`；修改 `src/import/importTypes.ts`。

**Interfaces:** `ImportSourceRef = { kind: 'screenshot'; pageId: string; line: number }`，作为 `ImportCandidate`、`ImportFragment`、`ImportNoteDraft` 的可选 `sourceRef`，不由提交服务持久化；片段另有可选 `recordedAtHint: string` 保留截图里的原始时间。`parseScreenshotImport(pages: ScreenshotPageDraft[], mode: ImportMode, defaultStatus: BookStatus): ImportParseResult`；同一连续组按行顺序解析，不同组独立，候选／片段 ID 在整批唯一。

- [ ] **步骤 1：写失败测试。** 两张独立截图的回复不跨图挂靠；显式续接才允许把下一张内容放入同一解析组。`144残次品` 形成书名“残次品”，`top1`、`好痛` 成为待确认片段；“Purani_ 博主”“来自江苏”“点赞 1”不成为作者、平台、书或想法；`共4条回复` 只产生“可能缺少回复”的警告，不补造四条。“每行一本书”和“字段段落”也只生成该模式明确允许的书和字段。
- [ ] **步骤 2：补日期与边界测试。** `24-10-27 12:12` 留作 `recordedAtHint`，`originalRecordedOn` 仍为 `null`；完整四位日期也须在预览确认后才写入想法日期。图片 EXIF／选图日期从不生成阅读日期；整批选择“读完”时生成的阅读日期仍为 `null`。多图文本超过 1 MiB、候选超过 500 时整体拒绝；中英书名和 emoji 保真，候选与片段能回到准确 `pageId`／行号。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/import/screenshotImportParser.test.ts`；预期新解析器缺失。
- [ ] **步骤 4：实现截图适配器。** 对明确书目格式保守提取；微博回复没有经用户确认的层级时保留为片段。只复用现有解析器中确实适合该格式的确定性部分，不能直接沿用文字导入对两位数年份的暂定 20xx 日期入库语义。UI 元数据仅按明确模式过滤，并保留隐藏回复警告。
- [ ] **步骤 5：运行绿灯和原文字导入回归。** `npm.cmd test -- --runInBand tests/import/screenshotImportParser.test.ts tests/import/textImportParser.test.ts`；预期全通过。
- [ ] **步骤 6：提交。** 只暂存本任务文件并提交 `feat: parse screenshot text into traceable import candidates`。

### 任务 4：预览中处理片段、回复和候选归属

**文件：** 修改 `src/import/importReview.ts`、`ImportReviewList.tsx`、`importTypes.ts`、`src/app/settings/import.tsx`、`tests/import/importReview.test.ts`、`tests/import/importPage.test.tsx`、`tests/import/tableImportPage.test.tsx`；新建 `src/import/importReviewActions.ts`、`tests/import/importReviewActions.test.ts`。

**Interfaces:** 用 `fragmentDecisions: Record<string, { kind: 'ignore' } | { kind: 'book'; candidateId: string } | { kind: 'note'; noteId: string }>` 取代 `ignoredFragmentIds`，更新文字／表格／手工候选的全部初始化处。`applyImportReviewAction(review: ImportReview, action: ImportReviewAction): ImportReview` 的 `ImportReviewAction` 是以下判别联合；拆出新书的标题可留空但不能确认导入。`validateImportReview` 要求每段有决定且 `book`／`note` 指向未跳过的候选；已确认想法的日期在用户输入有效四位年月日后写 `originalRecordedOn`，否则为 `null`。

```ts
type ImportReviewAction =
  | { type: 'ignore_fragment'; fragmentId: string }
  | { type: 'fragment_to_book'; fragmentId: string; candidateId: string; title: string }
  | { type: 'fragment_to_note'; fragmentId: string; candidateId: string; noteId: string; body: string }
  | { type: 'move_note'; noteId: string; targetCandidateId: string }
  | { type: 'delete_note'; noteId: string }
  | { type: 'split_candidate'; sourceCandidateId: string; newCandidateId: string; noteIds: string[] }
  | { type: 'merge_candidates'; sourceCandidateId: string; targetCandidateId: string }
  | { type: 'set_note_date'; noteId: string; date: string | null; time: string | null };
```

- [ ] **步骤 1：写失败的纯状态测试。** `top1` 片段附到用户选的《残次品》后才成为想法；移到《默读》后不在原书；设为新书产生可编辑候选；拆／合候选更新 `fragmentDecisions` 的目标；忽略计数准确。目标被删除／跳过、空想法、无决定片段阻止提交，片段不会被静默抛弃。
- [ ] **步骤 2：补日期与旧入口测试。** 两位数日期只显示原文提示，确认完整 `2024-10-27` 后才保存；无效日历日或 `24:90` 时间拒绝，清空日期恢复未知；主评论发布时间不生成阅读记录。原文字／表格导入中“忽略片段”、重复提醒、编辑状态／评分／想法及提交仍按原规则工作。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/import/importReviewActions.test.ts tests/import/importReview.test.ts tests/import/importPage.test.tsx`；预期新增行为断言失败。
- [ ] **步骤 4：实现状态操作与移动端预览。** 片段显示原图位置和原文，提供“作为想法附到…／设为新书／明确忽略”；想法有移动、删除和原记录日期编辑；候选有拆／合操作。最终确认列新增、追加、跳过及忽略片段数。删除已由片段生成的想法时须撤销对应决定，不能让片段虚假地显示为已处理；书名与想法重复确认保持原子提交服务可理解的状态。
- [ ] **步骤 5：运行绿灯。** 重跑步骤 3，加 `tests/import/tableImportPage.test.tsx tests/import/importCommitService.test.ts`；预期全通过。
- [ ] **步骤 6：提交。** 只暂存本任务文件并提交 `feat: resolve screenshot fragments before importing`。

### 任务 5：接入导入页、失败恢复与交付验证

**文件：** 修改 `src/import/ImportSourceForm.tsx`、`src/app/settings/import.tsx`、`README.md`、`tests/import/importPage.test.tsx`、`tests/import/importCommitService.test.ts`；只为本功能缺陷修复所必需的其他 `src/import/*` 与测试文件。

**Interfaces:** “从截图导入”进入同一 `/settings/import` 页的截图步骤；`parseScreenshotImport` 的结果进入现有 `buildReview`／重复检查，再调用现有 `ImportCommitService.commit(review)`。草稿在返回图片编辑、OCR 失败和提交错误后仍留在内存；离开导入页才结束会话。

- [ ] **步骤 1：写失败页面测试。** 选两张图、改文字并生成候选；重排图片或改“接上一张”后旧 `review` 作废；在 Expo Go 无模块时可手工输入并提交；选图取消、零候选、超限、某张 OCR 失败都不调用 `commit()`。从预览返回仍见图片和修正文字。
- [ ] **步骤 2：补原子提交测试。** 预览后目标书被删或出现重复，提交报冲突且原书库不变；事务中段失败不留半批记录；成功仅保存确认书、阅读记录和想法，不保存截图 URI／OCR 原文，随后普通搜索、备份／开放导出沿用现有数据结构。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/import/importPage.test.tsx tests/import/importCommitService.test.ts`；预期截图路径断言失败。
- [ ] **步骤 4：接入截图步骤。** 保留粘贴／TXT／CSV／XLSX 入口；相册、OCR、手工文字和候选预览按现有导航衔接。重排、改续接或修改文字后令旧预览失效；移除图片、退出或成功后调用任务 1 的受限临时缓存清理，失败不能回滚已成功的导入。
- [ ] **步骤 5：更新 README。** 说明 Expo Go 可手工导入、自动识字需专用开发版；不得把尚未在 iPhone 验证的中文识别写成“已通过”。
- [ ] **步骤 6：最后一次集中验证。** 运行 `npm.cmd test -- --runInBand tests/import tests/books/localImageTextRecognizer.test.ts tests/books/imageOcrWorker.test.ts tests/backup/backupService.test.ts tests/export/openExportService.test.ts`、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`git diff --check`；预期全部通过。若修改依赖或 Expo 配置，再运行 `npx.cmd expo-doctor`；未修改时不重复检查。
- [ ] **步骤 7：记录真机验收边界。** Expo Go 检查多图顺序、手工文字、片段归属、重复提醒、取消与提交；iPhone 专用开发版用匿名化微博截图检查离线中文 OCR、失败重试和日期确认。没有专用开发版实测时明确写“自动识字待实机验证”。
- [ ] **步骤 8：提交收尾。** 有改动才提交 `feat: import reviewed old records from screenshots`；不创建空提交。合并和推送按用户后续要求处理。
