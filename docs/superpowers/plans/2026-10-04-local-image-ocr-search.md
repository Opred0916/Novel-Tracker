# 本地图片文字识别与搜索 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or, if the user explicitly chooses delegation, `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the spec first.

**Goal / 目标：** 在 iPhone 上离线识别精彩片段和摘记截图文字，让现有书架搜索能找到原图，同时不改写用户摘记。

**Architecture / 架构：** 用 SQLite 保存可重建的 OCR 状态与文本，由单任务前台队列处理仍被摘记或精彩片段引用的本地图片。搜索仓储把 OCR 纳入现有逐词 AND 查询，并返回图片证据；页面只负责展示状态、摘要和原图预览。iOS Vision 封装在可选加载的 Expo 本地模块后面，Expo Go 无模块时保留原有功能。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、Expo SQLite、iOS Vision、Expo Modules API、Jest；Windows PowerShell 使用 `npm.cmd`／`npx.cmd`，项目无 Bun 锁文件。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-04-local-image-ocr-search-design.md`

## Global Constraints / 全局约束

- 只识别仍被 `highlight_images` 或 `note_images` 引用的本地图片；封面不参与。相同 `image_id` 只识别一次，不改变“我的想法”正文。
- OCR 不上传图片或文本，不调用网络 API，不引入服务端、API 密钥或会员检查。中文优先 `zh-Hans`，兼顾英文；准确性必须在真机验证。
- 新数据库版本 v11；备份格式继续 v4、开放导出继续 v2。OCR 是可重建索引，不加入备份或开放 ZIP；恢复后自动补索引。
- 一次处理一张，仅 App 前台执行；后台暂停，重启后把遗留 `processing` 恢复为 `pending`；`failed` 和 `empty` 不无限重试。图片与摘记保存不等待识别。
- 搜索继续是多词全部满足、可跨字段、状态／类型／标签组合筛选、按书去重；OCR 结果要有图片证据和可核对的原图入口。
- Expo Go 必须保持不崩溃，除 OCR 外现有功能可用；原生 OCR 需要专用开发版。iPhone EAS 设备构建须先确认 Apple 签名凭据；不能自动购买，缺凭据时只能报告真机 OCR 未验证。
- 只编辑本地 Expo 模块目录中的 Swift 文件，不直接编辑或提交生成的根目录 `ios/`、`android/`。实施前核对 SDK 57 文档和 `https://docs.expo.dev/llms.txt`。
- 按用户以往要求使用相关的定向测试；收尾只做一次集中回归、类型检查、lint 和 Expo Doctor。不把未做的 iPhone 实测写成通过。

## Review Focus

- 同一图片被图库、多个摘记和封面复用时，解除一个引用不能删原图；最后一个可搜索引用移除后不能继续命中。任务 2、4 的测试覆盖。
- 恢复备份或识别中途强退后，旧 `processing` 不得永久卡住，恢复前正在识别的旧图结果不能写进恢复后的同 ID 图片。任务 1、3、4、5 的测试覆盖。
- 中文连续文本、英文大小写、换行及 `%`／`_`／反斜杠仍按现有搜索规则，不得扩大匹配。任务 4 的测试覆盖。
- Expo Go、Android 或 Web 缺少 iOS 模块时，图片和非 OCR 搜索不能崩溃或误显示“已识别”。任务 3、5、6 的测试覆盖。
- 搜索结果到达详情前图片被删除或被错误地指向另一部书时，不得展示别人的图片。任务 5 的路由测试覆盖。

---

## 文件分工

- `src/storage/database.ts`：v11 表和索引；`src/books/imageOcrRepository.ts`：OCR 状态、待办、进度及可搜索引用查询。
- `src/books/imageOcrWorker.ts`：单张串行调度；`src/books/localImageTextRecognizer.ts`：可选原生模块适配接口与无模块回退。
- `src/books/notesRepository.ts`、`imageDeletionQueue.ts`：解除图片引用后的安全清理，以及按书／图片 ID 重新核对预览权限。
- `src/books/bookSearchRepository.ts`、`bookSearch.ts`、`BookCard.tsx`、`src/app/index.tsx`：OCR 匹配、图片证据及书架入口。
- `src/books/HighlightsSection.tsx`、`NotesSection.tsx`、新建 `ImagePreview.tsx`、`src/app/book/[id].tsx`、`src/storage/AppProvider.tsx`、`src/app/settings/backup.tsx`：新增／恢复触发、进度、重试和原图预览。
- `modules/novel-image-ocr/`：iOS Vision 本地模块；`package.json`、`package-lock.json`、`app.json`、新建 `eas.json`：专用开发版配置。对应 `tests/books/*`、`tests/backup/*` 承担回归。

### 任务 1：v11 OCR 索引与可恢复待办

**文件：** 修改 `src/storage/database.ts`；新建 `src/books/imageOcrRepository.ts`、`tests/books/imageOcrRepository.test.ts`；扩展 `tests/books/migration.test.ts`。

**Interfaces:** `ImageOcrStatus = 'pending' | 'processing' | 'recognized' | 'empty' | 'failed'`；`ImageOcrProgress = { done: number; total: number; failed: number }`，其中 `done` 数 `recognized`、`empty`、`failed`；`SqliteImageOcrRepository.reconcile(recoverInterrupted?: boolean): Promise<void>`、`nextPending(): Promise<{ imageId: string; bookId: string; localPath: string } | null>`、`markProcessing(imageId): Promise<boolean>`、`finish(imageId, text, recognizerVersion): Promise<void>`、`fail(imageId, errorCode): Promise<void>`、`retry(imageId): Promise<void>`、`progress(bookId?): Promise<ImageOcrProgress>`。`reconcile` 只为当前有图库／摘记引用而缺行的图片补 `pending`；仅应用启动、worker 尚未运行时传 `recoverInterrupted=true`，将上次遗留的 `processing` 重置，平时补新图不得重置正在识别的图片。`finish` 把空白识别结果记为 `empty`。

- [ ] **步骤 1：写失败测试。** `migrates_v10_without_changing_existing_records` 断言旧书／图片／摘记不变且新表可用；`reconcile_deduplicates_references_and_recovers_processing` 断言复用图仅一行、只在启动恢复旧 `processing`、工作中的再次补图不重排，成功／空白／失败不自动重排；`retry_only_existing_linked_image` 断言已删或仅作封面的图片不入队；`progress_counts_currently_referenced_images` 断言旧孤立资产不计数。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/imageOcrRepository.test.ts tests/books/migration.test.ts`；预期新增断言失败或新模块缺失。
- [ ] **步骤 3：实现迁移和仓储。** 新建 `image_ocr(image_id PRIMARY KEY REFERENCES image_assets(id) ON DELETE CASCADE, status, recognized_text, updated_at, recognizer_version, error_code)`，状态加 CHECK；`PRAGMA user_version = 11`。待办与计数使用相同“图库或摘记仍引用”的 SQL 谓词，`markProcessing` 只接受 `pending`。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`；提交 `feat: store recoverable local image OCR index`。

### 任务 2：解除图片引用后的安全清理

**文件：** 修改 `src/books/notesRepository.ts`、`src/storage/AppProvider.tsx`；扩展 `tests/books/notesRepository.test.ts`、`tests/books/imageDeletionQueue.test.ts`。

**Interfaces:** `SqliteNotesRepository` 接受已有 `ImageDeletionQueue`；`removeUnreferencedImages(txn, imageIds)` 仅在无 `highlight_images`、`note_images`、`books.cover_image_id` 引用时删除 `image_assets` 并将受管路径排入现有删除队列。`deleteNote`、`updateNote`、`removeHighlight` 在事务内解除关联后调用它，成功提交后排空文件删除队列；外部方法签名不变。

- [ ] **步骤 1：写失败测试。** `unlink_preserves_shared_or_cover_image` 断言删除其中一条关系后同图仍可被另一摘记／图库／封面访问；`unlink_last_reference_removes_asset_ocr_and_file` 断言最后关联移除后资产、OCR 行被删除，文件成功清理或留在待删队列供重试；`failed_transaction_keeps_references_and_file` 断言事务失败不丢原图。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/notesRepository.test.ts tests/books/imageDeletionQueue.test.ts`；预期新增断言失败。
- [ ] **步骤 3：实现局部清理。** 复用现有 `ImageDeletionQueue.enqueue`／`drain`，文件删除只针对其允许的受管目录；不改备份 ZIP 或其它封面删除语义。OCR 行随资产外键级联；仅解除图库关系但摘记仍引用时保留 OCR。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2、类型检查及 lint；提交 `fix: clean up unreferenced reading images safely`。

### 任务 3：可注入的本地识别队列与无模块回退

**文件：** 新建 `src/books/localImageTextRecognizer.ts`、`src/books/imageOcrWorker.ts`、`tests/books/imageOcrWorker.test.ts`、`tests/books/localImageTextRecognizer.test.ts`；修改 `src/storage/AppProvider.tsx`。

**Interfaces:** `LocalImageTextRecognizer = { isAvailable(): boolean; recognize(localPath: string): Promise<string> }`；`getLocalImageTextRecognizer(): LocalImageTextRecognizer` 通过 `requireOptionalNativeModule('NovelImageOcr')` 查找原生能力，无模块时 `isAvailable()` 为 false 且不运行任务；`ImageOcrWorker` 的 `resume(): void`、`pause(): void`、`invalidateAndPause(): void`、`kick(): void`、`retry(imageId): Promise<void>` 接受上述仓储与识别器。`pause` 停止启动下一张但允许当前结果正常落库；`invalidateAndPause` 为整库恢复作废当前结果，恢复完成后重排。`kick` 只启动一个循环，前台串行处理，失败记录简短错误类别而非图片路径／全文。

- [ ] **步骤 1：写失败测试。** `processes_one_image_at_a_time_and_does_not_block_save` 用可控 Promise 断言并发上限为 1；`pause_and_resume_preserve_pending_work`、`invalidate_discards_inflight_result_before_restore`、`empty_and_failed_do_not_spin`、`manual_retry_requeues_once`；`missing_native_module_keeps_worker_idle` 断言 Expo Go 回退不抛异常也不修改 OCR 行。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/imageOcrWorker.test.ts tests/books/localImageTextRecognizer.test.ts`；预期模块／行为测试失败。
- [ ] **步骤 3：实现队列与生命周期。** `AppProvider` 初始化、worker 启动前调用 `reconcile(true)`；之后按 `AppState` 前台／后台切换 `resume`／`pause`，新图及恢复后只调用 `reconcile(false)`。通过新增 `useImageOcr()` 暴露 `kick`、`retry`、`progress`、`isAvailable` 给页面。不要使用后台任务或定时无限轮询；被引用图片新增或备份恢复成功时显式补索引后 `kick`。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2、类型检查及 lint；提交 `feat: queue offline image text recognition`。

### 任务 4：书架 OCR 搜索与图片证据

**文件：** 修改 `src/books/bookSearch.ts`、`bookSearchRepository.ts`、`BookCard.tsx`、`src/app/index.tsx`；扩展 `tests/books/bookSearchRepository.test.ts`、`bookSearch.test.ts`、`bookRoutes.test.tsx`。

**Interfaces:** `BookSearchResult` 增加 `matchedImage: { imageId: string; source: 'highlight' | 'note'; snippet: string } | null`，保留 `matchedNoteSnippet`。每个关键词在书名、作者、主角、摘记正文或仍被图库／摘记引用且状态为 `recognized` 的 OCR 原文任一处命中；图片证据稳定选择 `image_assets.created_at DESC, image_assets.id ASC`，同时被两处引用时 `source='highlight'`。卡片有图片证据时显示“匹配图片文字”；若摘记与图片分别提供必要词，保留图片入口。

- [ ] **步骤 1：写失败查询测试。** `finds_image_only_and_note_only_images`、`combines_metadata_note_and_ocr_terms_with_filters`、`deduplicates_multiple_matching_images`、`ignores_cover_or_unlinked_or_pending_images`、`literal_like_characters_and_chinese_newlines`；明确断言来源、摘要和结果书 ID。
- [ ] **步骤 2：写失败书架测试。** OCR 独有命中显示“匹配图片文字”而非“匹配摘记”；点击时路由仅携带书 ID 与 `focusImageId`；纯书籍／摘记结果保持原表现，搜索框提示更新。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/books/bookSearchRepository.test.ts tests/books/bookSearch.test.ts tests/books/bookRoutes.test.tsx`；预期 OCR 断言失败。
- [ ] **步骤 4：实现查询与显示。** 沿用现有参数化 `LIKE ... ESCAPE` 和按书排序；为 OCR 匹配增加 `EXISTS`，不把 JOIN 行直接当书结果。摘要只截取命中附近文字，不写回摘记；旧查询完成不得覆盖新条件结果。
- [ ] **步骤 5：绿灯并提交。** 重跑步骤 3、类型检查及 lint；提交 `feat: search text found in saved images`。

### 任务 5：进度、重试与原图预览

**文件：** 新建 `src/books/ImagePreview.tsx`；修改 `src/books/notesRepository.ts`、`HighlightsSection.tsx`、`NotesSection.tsx`、`src/app/book/[id].tsx`、`src/app/settings/backup.tsx`、`src/storage/AppProvider.tsx`；新建 `tests/books/ImagePreview.test.tsx`；扩展 `tests/books/HighlightsSection.test.tsx`、`notesRepository.test.ts`、`bookRoutes.test.tsx`、`tests/backup/backupPage.test.tsx`。

**Interfaces:** `SqliteNotesRepository.resolveLinkedImage(bookId: string, imageId: string): Promise<{ image: ImageAsset; source: 'highlight' | 'note' } | null>`；`ImagePreview` 接收已验证的 `ImageAsset`、OCR 状态、关闭／重试回调。详情页从 `useLocalSearchParams` 读取可选 `focusImageId`，重新校验关系后才开预览；失效时显示“该图片已不存在”，仍正常显示书详情。

- [ ] **步骤 1：写失败图片测试。** 图库和摘记缩略图均可打开／关闭原图；单图失败有“重新识别”；`pending`、`processing`、`empty`、不可用环境的文案准确；旧图批量进度显示已完成／总数，页面关闭不取消持久队列。
- [ ] **步骤 2：写失败路由及恢复测试。** 搜索命中图片打开正确小说的正确原图；错误书 ID／图片已删不泄露别的书的图片；恢复前正在识别的旧图结果被作废，成功恢复 v4 或旧备份后触发 `reconcile(true)`／`kick`，OCR 索引可重建，但备份及开放导出版本不变。恢复失败时原书库的待办也能继续。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/books/ImagePreview.test.tsx tests/books/HighlightsSection.test.tsx tests/books/notesRepository.test.ts tests/books/bookRoutes.test.tsx tests/backup/backupPage.test.tsx`；预期新增断言失败。
- [ ] **步骤 4：实现页面接线。** 新图关系提交成功后触发队列；`HighlightsSection.onSelect` 与 `NotesSection` 图片点按共用预览。备份页在调用 `service.restore()` 前执行 `invalidateAndPause()`，结束后无论成功／失败都恢复工作；成功时对新库 `reconcile(true)` 并 `kick`，失败时对未替换的库恢复遗留待办，取消预览不碰队列。详情页在未支持 OCR 环境显示说明但不挡住图片浏览和旧搜索。
- [ ] **步骤 5：绿灯并提交。** 重跑步骤 3、类型检查及 lint；提交 `feat: preview and retry recognized screenshots`。

### 任务 6：iOS Vision 本地模块与专用开发版

**文件：** 新建 `modules/novel-image-ocr/` 内的模块配置、TypeScript 入口和 `ios/NovelImageOcrModule.swift`；修改 `package.json`、`package-lock.json`、`app.json`；新建 `eas.json`；扩展 `tests/books/localImageTextRecognizer.test.ts`。

**Interfaces:** 原生模块名 `NovelImageOcr`，公开 `recognize(localPath: string): Promise<string>`；Swift 用 `VNRecognizeTextRequest` 的准确模式，检测设备支持语言后优先 `zh-Hans` 并兼顾 `en-US`，逐行汇合 top candidate。无支持语言、路径不存在、图片不可读应抛可归类错误，不返回伪造文本。TypeScript 仍通过可选模块获取能力。

- [ ] **步骤 1：核对构建前提。** 阅读 Expo SDK 57／Expo Modules 和 Apple Vision 官方文档；确认用户是否已有可用 Apple 签名凭据。缺凭据时不购买、不尝试 EAS iPhone 构建，保留本任务的“真机未验收”状态；可继续完成不依赖签名的代码与单元测试。
- [ ] **步骤 2：写失败适配测试。** 模拟存在／不存在的 `NovelImageOcr` 模块，断言本地 `file://` 路径传入、无模块安全回退、原生错误只映射短错误类别；不记录路径或 OCR 全文。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/books/localImageTextRecognizer.test.ts`；预期原生适配断言失败。
- [ ] **步骤 4：创建并实现本地模块。** 按 Expo 官方 `create-expo-module --local --platform apple` 建立 `modules/novel-image-ocr/`，只保留需要的 Apple 代码；用 `npx.cmd expo install expo-dev-client`。配置 `eas.json` 的 `development` profile；`ios.bundleIdentifier` 使用 `com.opred0916.noveltracker`，若 Apple 账号中不可用则停下让用户选择，不默默改用别的标识。生成的根目录 `ios/`、`android/` 不入库。
- [ ] **步骤 5：验证并提交。** 定向适配测试、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`npx.cmd expo-doctor`、`npx.cmd expo export --platform ios`。仅在签名条件齐备且用户确认安装测试版后，运行 `npx.cmd eas-cli@latest build --platform ios --profile development` 并由用户在 iPhone 安装；无条件时明确标记“构建／真机未验收”，不能把打包 JS 成功当作 Swift 编译成功。提交 `feat: add on-device iOS Vision OCR`。

### 任务 7：集中回归、隐私说明与真机交接

**文件：** 修改 `README.md`；必要修正仅限本计划涉及文件。

- [ ] **步骤 1：更新说明。** 区分 Expo Go 和专用开发版；写明图片文字只在手机本地识别、旧图会补索引、恢复后暂时搜不到图片属重建过程、OCR 错误可重试；不暗示 Android OCR 已完成。
- [ ] **步骤 2：运行一次集中检查。** `npm.cmd test -- --runInBand tests/books/imageOcrRepository.test.ts tests/books/imageOcrWorker.test.ts tests/books/localImageTextRecognizer.test.ts tests/books/bookSearchRepository.test.ts tests/books/notesRepository.test.ts tests/books/bookRoutes.test.tsx tests/backup/backupPage.test.tsx`，再运行 `npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`git diff --check`。针对失败扩大到受影响测试，不默认跑无关全量套件。
- [ ] **步骤 3：真机清单。** 专用开发版先通过 Metro 加载页面，再关闭手机网络并添加中文、英文、无文字、损坏或超大截图，以证明 OCR 请求本身不依赖网络；开发版冷启动可能仍需 Metro，不能拿它证明发布版离线冷启动。核对自动识别、进度、失败重试、跨字段搜索、点结果看原图、复用／删除关联、旧备份恢复重建。记录实际 iPhone 型号、iOS 版本、构建号和通过／未通过项；没有设备构建则标为待验收。
- [ ] **步骤 4：提交与交接。** 提交 `docs: explain local image OCR workflow`；按用户当时要求决定合并与上传，不主动推送，不把“尚未完成真机验收”表述为已完成。

## SDK 与平台依据

- [Expo 本地模块创建](https://docs.expo.dev/more/create-expo-module/) 与 [SDK 57 可选原生模块 API](https://docs.expo.dev/versions/v57.0.0/sdk/expo/)：模块目录、自动链接及缺模块时的安全回退。
- [Apple Vision 文字识别](https://developer.apple.com/documentation/vision/recognizing-text-in-images)：设备本地识别、准确模式、中文／英文语言配置及支持检测。
- [Expo iOS 实体设备开发版](https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/)：签名凭据、Developer Mode、构建和安装前提。
