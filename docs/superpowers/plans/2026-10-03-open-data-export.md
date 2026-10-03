# 开放格式完整导出 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL：使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 逐项实施；用复选框（`- [ ]`）记录进度。实施前同时阅读设计文档。

**Goal / 目标：** 用户能从 iPhone 导出标准 ZIP，在 App 外查看完整 JSON、易读 CSV 和原图，且导出不改动书库。

**Architecture / 架构：** 沿用 `SqliteBackupRepository.createSnapshot()` 获取一致的数据库快照，用独立序列化器生成开放格式 JSON、CSV 与说明，再用独立归档器将这些文件和每张图片流式写入 ZIP。导出服务管理临时文件和并发，数据管理页提供入口并调用 iOS 系统分享；现有 `.noveltracker` 备份及恢复逻辑不改变。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、Expo SQLite、已有 `fflate`／`expo-file-system`／`expo-sharing`、Jest；不新增原生依赖。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-03-open-data-export-design.md`

## Global Constraints / 全局约束

- 输出文件名为 `NovelTracker-export-YYYYMMDD-HHMMSS.zip`；ZIP 固定含 `README.txt`、`library.json`、`books.csv`、`reading-history.csv`、`notes.csv`、`images.csv` 和按图片 ID 命名的 `images/` 文件。
- `library.json` 使用独立的 `exportFormat: "novel-tracker-open"`、`formatVersion: 1`，完整保留稳定 ID、排序、所有关联、可空日期及导入摘记来源时间；不导出设备绝对路径。
- CSV 是易读视图：UTF-8 BOM、英文列名、CRLF、标准引号转义；`= + - @` 等公式前缀的用户文字只在 CSV 中加安全单引号，JSON 保留原文。
- 一张图片资产只打包一次；封面、精彩片段、摘记通过 ID 引用它。缺图、非法关联、空间不足或写入失败均不分享残缺 ZIP。
- 导出只读；取消系统分享不表示文件已保存，不改变上次备份时间。`.noveltracker` 仍是 App 内恢复文件，开放 ZIP 此阶段不提供导入。
- 使用当前备份的安全预算：最多 20,000 张图片，元数据文件 6 个，未压缩内容合计不超过 2 GiB；`library.json` 不超过 10 MiB。所有临时文件在分享结束或错误后清理。
- Windows PowerShell 使用 `npm.cmd` 和 `npx.cmd`；实施涉及 Expo API 前按 `AGENTS.md` 核对 SDK 57 文档。iPhone 真机验收由用户进行，未实测不得声称通过。

## 文件分工

- `src/export/openExportTypes.ts`：开放格式版本、完整 JSON 数据类型、文本文件名及进度／错误类型。
- `src/export/openExportSerializer.ts`：从已验证的快照清单生成 `README.txt`、`library.json` 和四个 CSV；无文件、数据库或平台依赖。
- `src/export/openExportArchive.ts`：检查图片与安全上限，使用现有 `BackupFilePort` 分块写标准 ZIP；不承担恢复解析。
- `src/export/openExportService.ts`：获取 `SqliteBackupRepository` 快照、创建和清理临时操作目录，串行化本服务的导出。
- `src/export/openExportPlatform.ts`：通过 `expo-sharing` 分享已生成的 ZIP。
- `src/app/settings/export.tsx`、`src/app/settings/data.tsx`、`src/app/_layout.tsx`、`src/storage/AppProvider.tsx`：用户入口、数量与状态、服务接线。
- `tests/export/*`、`tests/books/bookRoutes.test.tsx`、`README.md`：格式、归档、服务、页面及使用说明的验收材料。

## Review Focus

- 书名或摘记以空白、控制字符后接 `= + - @` 开头时，表格打开不得执行公式；任务 1 测 CSV 安全转义且 JSON 原文不变。
- 含逗号、双引号、换行、emoji 的多条摘记，CSV 必须可回读为正确行数和正文；任务 1 测序列化往返。
- 导出中图片被删除或同一图片在多个位置使用时，不能交付漏图或重复图的 ZIP；任务 2 测缺图、大小变化和共用引用。
- 正在生成时重复点击、分享取消或分享抛错，临时文件均要清理且数据库不变；任务 3、4 测所有路径。
- 空书库、旧记录日期未知或摘记原记录时间未知时，文件仍有效且不出现虚构日期；任务 1、2 测空集合及 `null`／空格。

---

### 任务 1：独立格式与易读文本文件

**文件：** 新建 `src/export/openExportTypes.ts`、`src/export/openExportSerializer.ts`、`tests/export/openExportSerializer.test.ts`；使用现有 `src/backup/backupTypes.ts` 作为内部快照类型，不改它的格式版本。

**Interfaces:** `OpenExportDocument = { exportFormat: 'novel-tracker-open'; formatVersion: 1; exportedAt: string; appVersion: string; counts: BackupCounts } & BackupDataCollections & { images: BackupImageEntry[] }`；`OpenExportTextName = 'README.txt' | 'library.json' | 'books.csv' | 'reading-history.csv' | 'notes.csv' | 'images.csv'`；`OpenExportProgress = { stage: 'collecting' | 'checking_images' | 'packing'; processedBytes?: number; totalBytes?: number }`；`createOpenExportFiles(manifest: BackupManifestV3): Record<OpenExportTextName, Uint8Array>`。

- [ ] **步骤 1：写失败测试。** 构造含二刷、未知日期、导入摘记、主角、快捷／自定义标签、封面和共用图片的 v3 清单；断言 JSON 的 `exportFormat`／`formatVersion`、全部集合、ID、排序与图片相对路径；断言不含 `localPath`。空清单仍输出六个文本文件和四个 CSV 表头。
- [ ] **步骤 2：补 CSV 边界测试。** 书名和摘记含逗号、引号、CRLF、emoji，按 CSV 规则回读后仍是正确列数／行数；前导空白或控制字符后接 `= + - @` 的文字有安全单引号；相同文字在 JSON 中逐字不变；半星在 `books.csv` 显示为 0.5 星增量，未知日期为空单元格。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/export/openExportSerializer.test.ts`；预期新模块不存在或断言失败。
- [ ] **步骤 4：实现纯序列化。** `library.json` 从 v3 清单映射为独立 v1 文档，不复制备份格式号；CSV 四表使用固定列顺序、UTF-8 BOM、CRLF 与双引号转义。`README.txt` 解释英文枚举、空日期、字段 ID、未加密文件与“开放导出不可直接恢复”。
- [ ] **步骤 5：验证并提交。** `npm.cmd test -- --runInBand tests/export/openExportSerializer.test.ts` 通过；提交 `src/export/openExportTypes.ts`、`src/export/openExportSerializer.ts`、该测试，提交信息 `feat: serialize open library export`。

### 任务 2：流式 ZIP 与图片完整性

**文件：** 新建 `src/export/openExportArchive.ts`、`tests/export/openExportArchive.test.ts`；复用 `src/backup/backupFilePort.ts`、`backupValidation.ts` 和 `backupRepository.ts` 的接口，不修改恢复路径。

**Interfaces:** `OpenExportArchive(files: BackupFilePort, limits?: Partial<{ maxImages: number; maxJsonBytes: number; maxUncompressedBytes: number }>)`；`write(snapshot: BackupSnapshot, destinationUri: string, onProgress?: (progress: OpenExportProgress) => void): Promise<void>`。任务 1 的 `createOpenExportFiles()` 消费归档器组装并以现有 `validateBackupManifest()` 校验的 v3 数据。

- [ ] **步骤 1：写失败归档测试。** 用内存文件适配器打包一书两张图，其中一图同时作封面、精彩片段和摘记；用标准 ZIP 读取器确认六个文本条目、两张原图且没有重复 ID，解压后的图片字节等于源文件。
- [ ] **步骤 2：补错误与上限测试。** 缺图、读取中实际字节数与预查大小不一致、重复图片 ID、不安全图片路径、图片数／JSON 字节数／总字节数超过注入的较小测试上限、空间不足或写入中断，均拒绝并删除临时 ZIP；另断言默认上限恰为 20,000 张图、10 MiB JSON 和 2 GiB 总量；空书库 ZIP 仍可解压。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/export/openExportArchive.test.ts`；预期新归档器不存在。
- [ ] **步骤 4：实现归档器。** 图片先按 ID、所有权和路径校验，不做静默去重；使用 `Zip`、`ZipDeflate`、`ZipPassThrough` 与 `BackupFilePort.readChunks/openChunkWriter`。生成文本条目后逐图分块写入，核对读取字节数；ZIP 条目总数不超过 20,006，异常时关闭 writer 并删除目标文件。
- [ ] **步骤 5：验证并提交。** `npm.cmd test -- --runInBand tests/export/openExportArchive.test.ts` 通过；提交归档器和测试，提交信息 `feat: package open export with images`。

### 任务 3：只读导出服务与临时文件生命周期

**文件：** 新建 `src/export/openExportService.ts`、`tests/export/openExportService.test.ts`；复用 `src/backup/backupFileStorage.ts` 的操作目录和 `SqliteBackupRepository` 快照。

**Interfaces:** `OpenExportService(repository: SqliteBackupRepository, archive: OpenExportArchive, storage: BackupFileStorage, appVersion: string, idFactory: () => string, nowFactory?: () => Date)`；`getOverview(): Promise<BackupCounts>`；`createExport(onProgress?: (progress: OpenExportProgress) => void): Promise<{ operationId: string; uri: string }>`；`releaseExport(operationId: string): Promise<void>`。打开分享面板由任务 4 的页面自行显示状态。

- [ ] **步骤 1：写失败服务测试。** 一次调用只取一个 SQLite 快照，生成本地时间格式的 `.zip` 文件名，调用归档器后返回文件 URI；不调用恢复、导入、`replaceAll()` 或 `setLastGeneratedAt()`，数据库内容保持不变。
- [ ] **步骤 2：补生命周期测试。** 同实例并发调用只允许一项；快照、归档、临时目录创建任一步失败都清理已创建操作目录；`releaseExport()` 清理成功和分享取消的文件，且不碰用户外部保存的副本。日期格式化使用注入的 `Date`，避免依赖测试机器时区。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/export/openExportService.test.ts`；预期服务不存在。
- [ ] **步骤 4：实现服务。** 复用 `BackupFileStorage.createOperation('export', id)` 取得随机临时目录，在该目录写 `NovelTracker-export-YYYYMMDD-HHMMSS.zip`；`createSnapshot(appVersion, now.toISOString())` 只运行一次。服务不更新“上次生成备份”时间；App 启动的现有 `cleanupStaleOperations()` 也能清理遗留临时目录。
- [ ] **步骤 5：验证并提交。** `npm.cmd test -- --runInBand tests/export/openExportService.test.ts` 通过；提交服务和测试，提交信息 `feat: manage open export lifecycle`。

### 任务 4：手机入口与系统分享

**文件：** 新建 `src/export/openExportPlatform.ts`、`src/app/settings/export.tsx`、`tests/export/openExportPage.test.tsx`；修改 `src/app/settings/data.tsx`、`src/app/_layout.tsx`、`src/storage/AppProvider.tsx`、`tests/books/bookRoutes.test.tsx`。

**Interfaces:** `shareOpenExport(uri: string): Promise<void>` 使用已安装的 `expo-sharing`，ZIP MIME 为 `application/zip`，iOS UTI 为 `public.zip-archive`；`useOpenExportService(): OpenExportService` 由 Provider 提供。

- [ ] **步骤 1：写失败页面测试。** “数据管理”显示“导出开放格式”并能导航；导出页展示四项数量与未加密隐私提示，按钮调用 `createExport()` 后调用 `shareOpenExport(uri)`；成功、取消或分享错误都调用 `releaseExport(operationId)`，不显示“已安全备份”。
- [ ] **步骤 2：补交互测试。** 生成中按钮不可重复触发；空间不足、缺图、关联异常与分享不可用展示可理解提示；导出路径不调用备份恢复或旧记录导入。页面取消和卸载后不会误报外部保存成功。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/export/openExportPage.test.tsx tests/books/bookRoutes.test.tsx`；预期入口或页面断言失败。
- [ ] **步骤 4：实现页面与接线。** 在 `src/app/settings/data.tsx` 增加入口和用途说明，在布局中注册 `/settings/export`；Provider 构造服务并提供 hook；分享适配器先调用 `Sharing.isAvailableAsync()`，再调用 `Sharing.shareAsync()`。`finally` 清理临时操作；页面只展示“已生成，已打开分享面板”，不推断用户保存结果。
- [ ] **步骤 5：验证并提交。** `npm.cmd test -- --runInBand tests/export/openExportPage.test.tsx tests/books/bookRoutes.test.tsx` 通过；提交页面、接线和测试，提交信息 `feat: share open library export`。

### 任务 5：使用说明、回归检查与真机交接

**文件：** 修改 `README.md`；仅在前四项实际验收发现缺口时修改对应 `src/export/*` 或测试。

- [ ] **步骤 1：更新说明。** README 写清“数据管理 → 导出开放格式”、ZIP 内的 JSON／CSV／原图，以及它与 `.noveltracker` 备份恢复的差别；提示 ZIP 未加密、保存到“文件”需用户在分享面板完成。
- [ ] **步骤 2：运行必要检查。** `npm.cmd test -- --runInBand tests/export tests/backup/backupArchive.test.ts tests/backup/backupService.test.ts tests/books/bookRoutes.test.tsx`、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`git diff --check`；若碰到共享备份层回归，再扩展到 `tests/backup`，不无故重复全量测试。
- [ ] **步骤 3：准备真机清单。** 在 iPhone Expo Go 创建含二刷、未知历史日期、主角、标签、多条摘记、封面及共用图片的样例，导出后从“文件”传到电脑；解压并检查四个 CSV、JSON、原图能打开及关联，最后确认 App 内数据未变化。空书库和取消分享也各走一次；未得到用户真机结果时标为待验收。
- [ ] **步骤 4：提交收尾。** 有 README 或必要修正才提交；提交信息 `docs: explain open data export`。实施完成后按用户当时要求决定是否合并、上传，不自动声称真机通过。

**SDK 57 依据：** [Expo FileSystem](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/) 提供 `File.readableStream()`、`File.writableStream()` 和 `Paths.availableDiskSpace`；[Expo Sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/) 提供本地文件 `shareAsync()` 与 `isAvailableAsync()`。实施任务 2、4 前按 `AGENTS.md` 再核对当前安装版本和真机行为。
