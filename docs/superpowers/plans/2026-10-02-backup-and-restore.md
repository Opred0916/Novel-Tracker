# 备份与恢复 Implementation Plan

> **供执行者阅读：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项实施本计划。任务进度使用复选框（`- [ ]`）记录。

**目标：** 将当前完整离线书库导出为一个版本化 `.noveltracker` 备份包，并在完整验证和用户确认后以事务方式替换当前数据。

**架构：** 纯函数格式层负责 manifest 与关联验证；SQLite 仓储层负责一致快照和事务替换；归档与文件层使用 `fflate` 和 Expo FileSystem 流式处理 manifest 及去重图片。`BackupService` 协调临时目录、预览、图片分代和数据库切换，页面只负责选择文件、分享、确认和状态展示。

**技术栈：** Expo SDK 57、React Native、TypeScript、Expo SQLite、Expo FileSystem、Expo DocumentPicker、Expo Sharing、`fflate@0.8.3`、Jest、Testing Library React Native。

**设计文档：** `docs/superpowers/specs/2026-10-02-backup-and-restore-design.md`

## 全局约束

- 备份格式第一版固定为 `formatVersion: 1`，不导出原始 SQLite 文件，不保存设备绝对图片路径。
- 单个 `.noveltracker` ZIP 归档只允许 `manifest.json` 与其声明的 `images/` 条目；图片按 ID 去重且保留全部关联。
- 恢复只支持验证后的完整替换，不合并、不部分导入、不跳过错误。
- 验证、图片复制或 SQLite 事务失败时，当前数据库和图片保持可用；只有事务成功提交才切换到新数据。
- 安全上限：最多 20,001 个归档条目、`manifest.json` 最大 10 MiB、解压总量最大 2 GiB，且必须满足恢复临时空间需求。
- 归档只使用纯 TypeScript 依赖，必须在 iPhone Expo Go 中运行，不要求 development build。
- 用户取消文件选择、系统分享或恢复确认时安静返回，不写入数据，不显示失败。
- 页面只记录“上次生成备份”，不声称用户已在外部成功保存文件。
- 本次不实现自动备份、云同步、账号、备份加密、部分恢复或外部书目导入。
- Windows PowerShell 使用 `npm.cmd` 与 `npx.cmd`；平时只跑相关测试，收尾才跑一次全量测试、TypeScript 和 lint。

## 文件分工

- `src/backup/backupTypes.ts`：格式常量、manifest 数据类型、数量概览、错误代码和备份任务状态。
- `src/backup/backupValidation.ts`：从未知 JSON 验证字段、唯一 ID、外键、数量、日期、取值和安全相对路径。
- `src/backup/backupRepository.ts`：SQLite 数据概览、一致快照、事务替换和恢复后的旧图片路径清单。
- `src/backup/backupFilePort.ts`：归档所需的分块读写接口及 Expo FileSystem 适配器。
- `src/backup/backupArchive.ts`：`fflate` 流式 ZIP 打包、解包、条目限制、路径检查和字节数校验。
- `src/backup/backupFileStorage.ts`：临时操作目录、恢复图片分代、过期目录清理和“上次生成”本地记录。
- `src/backup/backupService.ts`：导出、恢复预检、用户确认后切换、失败回收和进度编排。
- `src/backup/backupPlatform.ts`：`expo-document-picker` 文件选择和 `expo-sharing` 系统分享薄适配层。
- `src/app/settings/backup.tsx`：数据概览、导出、恢复预览、二次确认、进度和错误界面。
- `src/storage/AppProvider.tsx`、`src/app/_layout.tsx`、`src/app/index.tsx`：备份服务注入、路由和设置入口。
- `tests/backup/*`：格式、SQLite、归档、文件分代、服务编排和页面集成测试。

## Review Focus

- 带 `../`、绝对路径、反斜杠跳转、重复条目或超出声明大小的归档必须在写入 App 目录前被拒绝；由任务 1 与任务 3 测试锁定。
- 格式版本过新、数量不符、重复 ID、缺失外键或未声明图片必须整包拒绝，不允许“尽量导入”；由任务 1 与任务 4 测试锁定。
- 图片分代已写入但 SQLite 事务失败时，新分代必须删除且旧数据与旧图片可用；由任务 2 与任务 4 测试锁定。
- 同一图片被多条摘记和精彩片段共享时，归档内只有一份字节，恢复后所有关联仍存在；由任务 2～4 的往返测试锁定。
- 文件选择、分享、预览或二次确认被取消时，不能显示假失败、改动数据或留下临时文件；由任务 4 与任务 5 测试锁定。

---

### 任务 1：备份格式、测试数据与纯验证

**文件：**

- 创建：`src/backup/backupTypes.ts`
- 创建：`src/backup/backupValidation.ts`
- 创建：`tests/backup/backupFixtures.ts`
- 创建：`tests/backup/backupValidation.test.ts`

**接口：**

- 产出：`BACKUP_FORMAT_VERSION = 1`、`MAX_ARCHIVE_ENTRIES = 20_001`、`MAX_MANIFEST_BYTES = 10 * 1024 * 1024`、`MAX_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024`。
- 产出：`BackupDataCollections`、`BackupManifestV1`、`BackupCounts`、`BackupImageEntry`、`BackupProgressStage`、`BackupErrorCode`、`BackupValidationError`。`BackupDataCollections` 包含除 images 以外的全部版本化数据数组，manifest 在此基础上增加元数据、counts 和最终图片条目。
- 产出：`validateBackupManifest(input: unknown): BackupManifestV1`、`isSafeArchivePath(path: string): boolean`、`countsFromManifest(manifest: BackupManifestV1): BackupCounts`。

- [ ] **步骤 1：编写格式成功与字段边界失败测试。** 用完整 fixture 断言格式 1 通过；空书库通过；缺失必填数组、空书名、空摘记、无效状态／类型／评分／日期和过新格式分别返回稳定错误代码。
- [ ] **步骤 2：编写关联与路径安全失败测试。** 覆盖重复 ID、不存在的书籍／标签／摘记／阅读记录／图片外键、counts 不符、重复包路径、`../x`、`/x`、`C:\x` 与反斜杠跳转。
- [ ] **步骤 3：运行测试确认红灯。**

  运行：`npm.cmd test -- --runInBand tests/backup/backupValidation.test.ts`

  预期：格式模块不存在或验证断言失败。

- [ ] **步骤 4：实现格式类型和纯验证。** 验证顺序固定为包装对象／版本、标量字段、数组条目、唯一性、关联、counts 与安全路径；拒绝时抛出 `BackupValidationError`，不修改输入。
- [ ] **步骤 5：运行相关测试和类型检查。**

  运行：`npm.cmd test -- --runInBand tests/backup/backupValidation.test.ts`、`npx.cmd tsc --noEmit`

  预期：全部通过。

- [ ] **步骤 6：提交。**

  ```bash
  git add src/backup/backupTypes.ts src/backup/backupValidation.ts tests/backup/backupFixtures.ts tests/backup/backupValidation.test.ts
  git commit -m "feat: define versioned backup format"
  ```

### 任务 2：SQLite 快照与事务替换

**文件：**

- 创建：`src/backup/backupRepository.ts`
- 创建：`tests/backup/backupRepository.test.ts`
- 修改：`tests/helpers/inMemoryDatabase.ts`（仅在需要故障注入时）

**接口：**

- 消费：任务 1 的 `BackupManifestV1`、`BackupCounts` 与已验证关联。
- 产出：`BackupImageSource { id: string; bookId: string; createdAt: string; extension: string; localPath: string; archivePath: string }`、`BackupSnapshot { formatVersion: 1; exportedAt: string; appVersion: string; data: BackupDataCollections; images: BackupImageSource[] }`。数据库快照不猜测文件字节数；任务 3 读取文件后才生成最终 `BackupImageEntry`、counts 和 manifest。
- 产出：`SqliteBackupRepository.getOverview(): Promise<BackupCounts>`、`createSnapshot(appVersion: string, exportedAt: string): Promise<BackupSnapshot>`、`replaceAll(manifest: BackupManifestV1, restoredImagePaths: ReadonlyMap<string, string>): Promise<string[]>`。`replaceAll` 成功时返回恢复前的旧图片路径，失败时不返回且数据库回滚。

- [ ] **步骤 1：编写完整快照失败测试。** 在 v6 内存库中创建两本书、主角、系统与自定义标签、快捷标签、二刷、摘记、共享图片和精彩片段，断言 manifest 保留稳定 ID、顺序和全部值，images 仅含一份共享文件源。
- [ ] **步骤 2：编写完整替换与回滚失败测试。** 先保存一套旧数据，再恢复不同 manifest；断言旧记录全部被替换、新关联正确、`PRAGMA user_version` 仍为 6。在事务中部注入失败，断言旧数据的表内容逐项不变。
- [ ] **步骤 3：运行测试确认红灯。**

  运行：`npm.cmd test -- --runInBand tests/backup/backupRepository.test.ts`

  预期：仓储模块不存在。

- [ ] **步骤 4：实现数据概览和一致快照。** 按稳定的 ID／position 顺序读取所有表；快照数据集不含设备路径，图片源清单单独保留当前 `localPath` 和由 ID 生成的安全归档路径。
- [ ] **步骤 5：实现单事务完整替换。** 输入只接受任务 1 已验证 manifest；按外键安全顺序删除旧关联和主表、插入新表内容，图片路径只取自 `restoredImagePaths`，不修改 schema 或 `user_version`。
- [ ] **步骤 6：运行仓储测试与类型检查。**

  运行：`npm.cmd test -- --runInBand tests/backup/backupRepository.test.ts tests/books/migration.test.ts`、`npx.cmd tsc --noEmit`

  预期：全部通过。

- [ ] **步骤 7：提交。**

  ```bash
  git add src/backup/backupRepository.ts tests/backup/backupRepository.test.ts tests/helpers/inMemoryDatabase.ts
  git commit -m "feat: snapshot and replace local library"
  ```

### 任务 3：流式归档与 Expo 文件适配器

**文件：**

- 修改：`package.json`、`package-lock.json`
- 创建：`src/backup/backupFilePort.ts`
- 创建：`src/backup/backupArchive.ts`
- 创建：`tests/backup/backupArchive.test.ts`

**接口：**

- 消费：任务 1 的验证函数与安全上限，任务 2 的 `BackupSnapshot`。writer 用 `stat` 获得每个图片字节数，组装最终 `BackupManifestV1` 后再写入归档。
- 产出：`BackupFilePort`，它提供 `stat(uri)`、`readChunks(uri, chunkSize)`、`openChunkWriter(uri)`、`remove(uri)`、`availableDiskSpace()`；生产适配器使用 Expo SDK 57 `File`、`FileHandle`、`Directory` 和 `Paths`。
- 产出：`BackupArchive.write(snapshot: BackupSnapshot, destinationUri: string, onProgress?: (progress: BackupArchiveProgress) => void): Promise<void>`。
- 产出：`BackupArchive.inspect(sourceUri: string, extractDirectoryUri: string, onProgress?: ...): Promise<ValidatedBackupArchive>`，结果含已验证 manifest 和按 image ID 索引的解包图片路径。

- [ ] **步骤 1：安装唯一新依赖。**

  运行：`npm.cmd install fflate@0.8.3`

  预期：`package.json` 和 lockfile 只新增 `fflate@0.8.3`，不引入原生模块。

- [ ] **步骤 2：编写内存文件端口上的归档往返失败测试。** 生成含 manifest 和一张图片的包，再分块读回；断言 JSON 值、图片字节、进度顺序和图片去重。
- [ ] **步骤 3：编写恶意与超限归档失败测试。** 覆盖路径跳转、绝对路径、重复条目、额外未声明文件、manifest 超 10 MiB、条目数超 20,001、解压字节超 2 GiB（用虚拟计数器，不分配大内存）、声明大小与实际不符和空间不足。
- [ ] **步骤 4：运行测试确认红灯。**

  运行：`npm.cmd test -- --runInBand tests/backup/backupArchive.test.ts`

  预期：归档模块不存在。

- [ ] **步骤 5：实现 `BackupFilePort` 与内存测试适配器。** 固定 256 KiB 块大小；writer 成功、失败和取消都关闭 FileHandle，无效读写不留下半成品目标文件。
- [ ] **步骤 6：实现 `BackupArchive`。** 使用 `fflate.Zip`、`ZipDeflate`、`ZipPassThrough` 和 `Unzip`的同步流式 API，不使用 Worker 异步 API；manifest 压缩，图片 pass-through；边读边计数、验证和写入。
- [ ] **步骤 7：运行归档测试、类型检查和 iOS bundle 检查。**

  运行：`npm.cmd test -- --runInBand tests/backup/backupArchive.test.ts`、`npx.cmd tsc --noEmit`、`npx.cmd expo export --platform ios --output-dir .expo-export-backup-check`

  预期：测试和类型通过，iOS 导出不报 Node builtin、Worker 或原生模块错误；检查后删除未跟踪的 `.expo-export-backup-check` 目录。
- [ ] **步骤 8：提交。**

  ```bash
  git add package.json package-lock.json src/backup/backupFilePort.ts src/backup/backupArchive.ts tests/backup/backupArchive.test.ts
  git commit -m "feat: stream versioned backup archives"
  ```

### 任务 4：文件分代与备份服务编排

**文件：**

- 创建：`src/backup/backupFileStorage.ts`
- 创建：`src/backup/backupService.ts`
- 创建：`tests/backup/backupFileStorage.test.ts`
- 创建：`tests/backup/backupService.test.ts`

**接口：**

- 消费：任务 2 的 `SqliteBackupRepository`、任务 3 的 `BackupArchive` 和 `BackupFilePort`。
- 产出：`BackupFileStorage.createOperation(kind, id)`、`createRestoreGeneration(id)`、`copyValidatedImages(archive, generation)`、`removeOperation(id)`、`removeGeneration(id)`、`cleanupObsolete(activePaths)`、`getLastGeneratedAt()`、`setLastGeneratedAt(value)`。
- 产出：`BackupInspection { token: string; sourceUri: string; manifest: BackupManifestV1; counts: BackupCounts; stagingOperationId: string }`；token 由服务内部保存，页面不能构造或修改已验证内容。
- 产出：`BackupService.getOverview()`、`createBackup(onProgress?)`、`inspectBackup(sourceUri, onProgress?)`、`restore(inspectionToken, onProgress?)`、`cancelInspection(token)`、`cleanupStaleOperations()`。

- [ ] **步骤 1：编写文件分代和偏好记录失败测试。** 覆盖随机操作目录、恢复图片只存一份、失败删除新分代、成功后保留活跃分代、重启清理过期临时目录、有效／损坏“上次生成”记录。
- [ ] **步骤 2：编写服务完整往返与取消失败测试。** 导出快照生成单文件；检查备份仅返回预览而不写库；确认后替换并清理；取消检查删除 staging 且不调用 `replaceAll`。
- [ ] **步骤 3：编写回滚失败测试。** 分别让归档生成、图片拷贝、SQLite 替换和旧文件清理失败；前三者必须报错并保留旧书库，旧文件清理失败不伪装数据恢复失败，而是保留待重试清理状态。
- [ ] **步骤 4：运行测试确认红灯。**

  运行：`npm.cmd test -- --runInBand tests/backup/backupFileStorage.test.ts tests/backup/backupService.test.ts`

  预期：文件存储和服务模块不存在。

- [ ] **步骤 5：实现文件分代、临时目录与本地记录。** 目录名只由服务生成的 UUID 派生；本地记录损坏时当作“尚未生成备份”，不阻断页面。
- [ ] **步骤 6：实现服务状态机。** 一次只允许一个操作；进度顺序为 `collecting`、`packing`、`validating`、`staging`、`restoring`、`cleaning`；每条失败路径在抛错前回收本次临时资源。
- [ ] **步骤 7：运行服务与相关回归测试。**

  运行：`npm.cmd test -- --runInBand tests/backup/backupFileStorage.test.ts tests/backup/backupService.test.ts tests/backup/backupRepository.test.ts`、`npx.cmd tsc --noEmit`

  预期：全部通过。

- [ ] **步骤 8：提交。**

  ```bash
  git add src/backup/backupFileStorage.ts src/backup/backupService.ts tests/backup/backupFileStorage.test.ts tests/backup/backupService.test.ts
  git commit -m "feat: orchestrate safe backup restoration"
  ```

### 任务 5：设置页、系统选择／分享与 Provider 集成

**文件：**

- 创建：`src/backup/backupPlatform.ts`
- 创建：`src/app/settings/backup.tsx`
- 修改：`src/storage/AppProvider.tsx`
- 修改：`src/app/_layout.tsx`
- 修改：`src/app/index.tsx`
- 创建：`tests/backup/backupPage.test.tsx`
- 修改：`tests/books/bookRoutes.test.tsx`

**接口：**

- 消费：任务 4 的 `BackupService`、`BackupInspection`、进度阶段和稳定错误代码。
- 产出：`BackupPlatform.pickBackupFile(): Promise<string | null>`、`shareBackup(uri: string): Promise<void>`；选择器使用 `copyToCacheDirectory: true`、单选和 `.noveltracker` MIME／扩展名退化策略。Expo Sharing 不承诺告知用户是保存还是取消，因此分享面板关闭只触发临时文件清理，不更新为“已保存”。
- 产出：`useBackupService(): BackupService`；Provider 与其他仓储共享同一 SQLite 连接。

- [ ] **步骤 1：编写系统适配器和页面失败测试。** 覆盖概览和“尚未生成备份”、导出进度与按钮禁用、分享面板关闭后清理临时文件、文件选择取消、验证错误文案、预览数量、替换警告和二次确认。
- [ ] **步骤 2：编写成功恢复和失败保护页面测试。** 确认后才调用 `restore(token)`；恢复成功刷新概览并回到书架；失败显示“原有数据未发生变化”且留在页面。
- [ ] **步骤 3：编写路由与 Provider 集成失败测试。** 书架“备份与恢复”入口打开 `/settings/backup`；Provider 未就绪不渲染子页，初始化失败沿用当前错误页。
- [ ] **步骤 4：运行测试确认红灯。**

  运行：`npm.cmd test -- --runInBand tests/backup/backupPage.test.tsx tests/books/bookRoutes.test.tsx`

  预期：备份页或 Provider hook 不存在。

- [ ] **步骤 5：实现系统选择与分享适配器。** 文件选择取消返回 `null`；分享面板关闭解决 `Promise<void>`，不猜测用户是保存还是取消；其他异常转为页面可区分的备份错误，不在适配器内显示 Alert。
- [ ] **步骤 6：把备份服务注入 Provider 并注册路由。** App 启动时调用 `cleanupStaleOperations()`，清理失败不阻断打开书架；备份核心服务初始化失败才进入 Provider 错误页。
- [ ] **步骤 7：实现备份页和书架入口。** 处理中显示阶段文案并禁用两个主按钮；预览只读；恢复必须经独立确认 Alert；页面卸载时取消未确认 inspection 并清理 staging。
- [ ] **步骤 8：运行页面、服务和书架回归测试。**

  运行：`npm.cmd test -- --runInBand tests/backup/backupPage.test.tsx tests/backup/backupService.test.ts tests/books/bookRoutes.test.tsx`、`npx.cmd tsc --noEmit`

  预期：全部通过。

- [ ] **步骤 9：提交。**

  ```bash
  git add src/backup/backupPlatform.ts src/app/settings/backup.tsx src/storage/AppProvider.tsx src/app/_layout.tsx src/app/index.tsx tests/backup/backupPage.test.tsx tests/books/bookRoutes.test.tsx
  git commit -m "feat: add backup and restore settings"
  ```

### 任务 6：文档、完整验证与 iPhone 验收

**文件：**

- 修改：`README.md`
- 修改：仅修复本功能发现问题所必需的 `src/backup/*`、`src/app/settings/backup.tsx` 或 `tests/backup/*`

**接口：**

- 消费：任务 1～5 的最终公开接口。
- 产出：一份可在 iPhone Expo Go 真机执行的验收清单和 README 安全说明。

- [ ] **步骤 1：更新 README。** 说明如何生成备份、如何完整恢复、恢复会替换当前数据、备份包含私人内容，并移除“备份尚未完成”的过时警告。
- [ ] **步骤 2：运行最后一次自动化检查。**

  运行：`npm.cmd test -- --runInBand`、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`git diff --check`

  预期：全部测试、TypeScript、lint 和空白字符检查通过。`fflate` 为纯 TypeScript 依赖，不重复运行 Expo Doctor；若 iOS bundle 检查或 Expo Go 出现依赖错误才追加。
- [ ] **步骤 3：在 iPhone Expo Go 执行真机往返。** 创建含二刷、多条摘记和共享图片的测试书库；导出到“文件”；修改当前书库；预览并确认恢复；检查书籍、标签、历史、摘记、图片关联、搜索和筛选。
- [ ] **步骤 4：在真机尝试无效文件与取消路径。** 选择普通 JSON 或损坏包，确认不覆盖当前数据；分别取消文件选择、分享和最终确认，确认没有假失败或数据变化。
- [ ] **步骤 5：修复验收中发现的本功能问题。** 每个问题先用最小自动化测试复现，再修复并只重跑相关测试；最后修复后再执行一次步骤 2。
- [ ] **步骤 6：提交收尾。** 如没有文件变更则不创建空提交；如有 README 或验收修复，使用：

  ```bash
  git add README.md src/backup src/app/settings/backup.tsx tests/backup
  git commit -m "test: verify backup and restore"
  ```
