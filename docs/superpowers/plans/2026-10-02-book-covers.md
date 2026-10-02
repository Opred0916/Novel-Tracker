# 小说封面 Implementation Plan

> **供执行者阅读：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项实施本计划。任务进度使用复选框（`- [ ]`）记录。

**目标：** 让每本小说可从相册或 HTTPS 图片链接设置一张可离线显示的封面，并保持旧书、旧备份及现有图片关联可用。

**架构：** `BookCoverFiles` 负责选中图片的暂存、网络下载验证和本地文件生命周期；`SqliteBookRepository` 在书籍事务中关联封面图片，书架与详情共用一个封面展示组件。备份格式升至第 2 版，同时把第 1 版输入规范化为“没有封面”的第 2 版数据，再沿用既有完整替换流程。

**技术栈：** Expo SDK 57、React Native、TypeScript、Expo SQLite、已安装的 Expo ImagePicker 和 Expo FileSystem、Jest、Testing Library React Native。

**设计文档：** `docs/superpowers/specs/2026-10-02-book-covers-design.md`

## 全局约束

- 每本书最多一张封面；封面可选，旧书迁移后为 `null`；只填书名仍可新增小说。
- 未设置或无法加载图片时，默认封面显示当前书名；最多三行，超出以省略号收尾，改名立即更新。默认封面不存文件、不入备份。
- 网络输入仅接受 HTTPS 直达图片；重定向后仍须 HTTPS，单张图片最多 10 MiB，按实际字节数限制，拒绝非图片。
- 图片一旦保存，应用只读取自己的本地副本；打开书架不向原链接发请求。
- 表单取消、下载失败、数据库提交失败或旧封面仍被摘记／精彩片段引用时，不丢失原封面及已有图片。
- 数据库迁移从 `user_version = 6` 升至 7；新备份为 `formatVersion: 2`，第 1 版备份仍可完整恢复。
- 不增加图片搜索、自动匹配、裁剪、账号、服务器或需要定制开发版的新原生依赖。
- Windows PowerShell 使用 `npm.cmd`、`npx.cmd`；每项先跑相关测试，收尾才跑一次全量测试、TypeScript 与 lint。

## 文件分工

- `src/storage/database.ts`：增加书籍的可空封面关联和版本 7 迁移。
- `src/books/types.ts`、`src/books/validation.ts`：封面字段、设置／移除／不变三态输入与原有资料校验。
- `src/books/bookCoverFiles.ts`：相册图片暂存、HTTPS 下载、大小及图片格式验证、复制到应用目录和临时文件清理。
- `src/books/sqliteRepository.ts`：封面读写、归属检查、事务提交和旧图片引用清理；`src/books/bookSearchRepository.ts` 保持封面读取不额外增加每卡片查询；`src/storage/AppProvider.tsx` 注入图片文件服务。
- `src/books/BookCover.tsx`：真实图片与带书名的默认封面共用展示。
- `src/books/BookCoverField.tsx`：表单中的相册／链接选择、预览、进度、失败和暂存清理。
- `src/books/AddBookForm.tsx`、`src/books/BookEditForm.tsx`、`src/books/BookCard.tsx`、`src/books/BookDetail.tsx`：新增、编辑、书架和详情接入；路由继续只做加载与导航。
- `src/backup/backupTypes.ts`、`backupValidation.ts`、`backupRepository.ts`、`backupArchive.ts`、`backupService.ts`：第 2 版备份输出、第 1 版兼容输入、封面关联校验和恢复。
- `tests/books/*`、`tests/backup/*`：迁移、图片获取、事务、界面、备份新旧版本和异常回归。

## Review Focus

- 网络图片重定向到 HTTP、服务器谎报长度、分块传输超过 10 MiB 或返回 HTML 时，必须拒绝并保留原封面；任务 2 的下载测试覆盖。
- 编辑表单更换封面后直接返回、相册取消或下载失败时，原资料和原图片不变，暂存文件被清理；任务 3 与任务 4 的测试覆盖。
- 文件复制成功而 SQLite 事务失败，不能留下新的封面关联或损坏旧封面；任务 3 的故障注入测试覆盖。
- 封面图片同时出现在精彩片段或摘记时，移除封面仅解除封面关联；任务 3 的共享图片测试覆盖。
- 第 1 版备份可恢复为无封面；第 2 版中的封面 ID 缺失、属于别的书或图片损坏时，恢复前整包拒绝，现有书库不变；任务 5 的备份测试覆盖。

---

### 任务 1：数据库迁移与书籍封面字段

**文件：**

- 修改：`src/storage/database.ts`、`src/books/types.ts`、`src/books/sqliteRepository.ts`、`src/books/bookSearchRepository.ts`
- 测试：`tests/books/migration.test.ts`、`tests/books/sqliteRepository.test.ts`、`tests/books/bookSearchRepository.test.ts`

**接口：**

- 产出：`Book.coverImageId: string | null`、`Book.coverUri: string | null`；`BookInput`、`BookEditInput` 暂不改变保存签名。
- 产出：`migrateDatabase(db): Promise<void>`，升级后 `PRAGMA user_version = 7`，`books.cover_image_id` 可空并引用 `image_assets.id`。
- 消费方：任务 3 的仓储保存、任务 4 的展示、任务 5 的备份快照。

- [ ] **步骤 1：编写失败的迁移与读取测试。** 从现有 v6 数据升级两次，断言旧书、摘记、图片不变，`cover_image_id` 为 `NULL`，版本为 7；有封面的书籍在 `get/list/search` 结果中带同一 ID 与本地 URI，未设置时两字段均为 `null`。
- [ ] **步骤 2：运行测试确认红灯。** 运行 `npm.cmd test -- --runInBand tests/books/migration.test.ts tests/books/sqliteRepository.test.ts tests/books/bookSearchRepository.test.ts`；预期新字段／版本断言失败。
- [ ] **步骤 3：实现迁移和读取映射。** `books` 新表定义与已有表迁移均加入可空外键；读取时左连接 `image_assets` 获得路径，禁止额外逐卡片查询。更新固定版本号断言。
- [ ] **步骤 4：运行相关测试与类型检查。** 运行上述测试及 `npx.cmd tsc --noEmit`；预期全绿。
- [ ] **步骤 5：提交。** `git add src/storage/database.ts src/books/types.ts src/books/sqliteRepository.ts src/books/bookSearchRepository.ts tests/books`；`git commit -m "feat: add optional book cover reference"`。

### 任务 2：图片暂存与 HTTPS 获取

**文件：**

- 创建：`src/books/bookCoverFiles.ts`、`tests/books/bookCoverFiles.test.ts`
- 复用：`src/books/imagePicker.ts` 中的 Expo ImagePicker 调用模式。

**接口：**

- 产出：`StagedCover { uri: string; extension: string }`，`BookCoverFiles.stageFromPicker(uri: string): Promise<StagedCover>`、`stageFromUrl(url: string): Promise<StagedCover>`、`copyToBook(stage: StagedCover, bookId: string, imageId: string): Promise<string>`、`discard(stage: StagedCover): Promise<void>`、`removeFile(uri: string): Promise<void>`。
- 产出：`MAX_COVER_BYTES = 10 * 1024 * 1024`。暂存和正式文件均由应用生成安全文件名，`StagedCover.uri` 只指向应用私有临时文件。
- 消费方：任务 3 的仓储、任务 4 的表单。

- [ ] **步骤 1：编写失败的本地及网络测试。** 相册 URI 复制后可用于预览，超过 10 MiB 的相册图片被拒绝；有效 JPEG／PNG／WebP HTTPS 图片暂存成功；HTTP、跳转至 HTTP、HTML、假图片、谎报 `Content-Length`、实际字节超过 10 MiB、超时和网络中断均拒绝且清理部分文件。
- [ ] **步骤 2：运行测试确认红灯。** 运行 `npm.cmd test -- --runInBand tests/books/bookCoverFiles.test.ts`；预期模块不存在或断言失败。
- [ ] **步骤 3：实现文件服务。** 使用 SDK 57 的 `expo/fetch` 响应流与 Expo FileSystem 文件写入；逐次验证重定向目标仍为 HTTPS，最多跟随 5 次。验证响应类型、实际字节和图片可解码性；按块接收并限制总量，失败时关闭读写句柄、删除暂存文件。相册选择器返回的格式以设备可显示为准；不把远程 URL 长期存进书籍记录。
- [ ] **步骤 4：运行相关测试、类型检查和 iOS 打包检查。** 运行本任务测试、`npx.cmd tsc --noEmit`、`npx.cmd expo export --platform ios --output-dir .expo-export-cover-check`；预期不需要新增原生模块。检查后只清理该命名的临时导出目录。
- [ ] **步骤 5：提交。** `git add src/books/bookCoverFiles.ts tests/books/bookCoverFiles.test.ts`；`git commit -m "feat: stage local and HTTPS book covers"`。

### 任务 3：书籍保存与图片引用生命周期

**文件：**

- 修改：`src/books/types.ts`、`src/books/validation.ts`、`src/books/sqliteRepository.ts`、`src/storage/AppProvider.tsx`
- 测试：`tests/books/editBook.test.ts`、`tests/books/sqliteRepository.test.ts`、`tests/books/notesRepository.test.ts`

**接口：**

- 消费：任务 2 的 `StagedCover` 与 `BookCoverFiles`。
- 产出：`BookInput.coverSource?: StagedCover`；`BookEditInput.coverChange?: { kind: 'keep' } | { kind: 'remove' } | { kind: 'set'; source: StagedCover }`。未传 `coverChange` 等同 `keep`；现有调用不受影响。
- 产出：`SqliteBookRepository.create(input): Promise<Book>` 与 `update(id, input): Promise<Book>` 保持签名；构造函数注入可替换的 `BookCoverFiles` 供故障测试使用。

- [ ] **步骤 1：编写失败的事务测试。** 新增与编辑设置、替换、移除封面均使 `get/list` 返回正确路径并更新时间；将甲书图片设为乙书封面时报错；旧封面仍在摘记／精彩片段中被引用时文件保留；复制成功后注入数据库失败，原数据不变且新文件被删除。
- [ ] **步骤 2：运行测试确认红灯。** 运行 `npm.cmd test -- --runInBand tests/books/editBook.test.ts tests/books/sqliteRepository.test.ts tests/books/notesRepository.test.ts`；预期新输入及关联断言失败。
- [ ] **步骤 3：实现事务保存与补偿清理。** 生成新书 ID 后复制暂存图片；在单次 SQLite 事务中写书籍、`image_assets` 与 `cover_image_id`，更新时同时保留既有状态、标签和阅读历史操作。提交失败时删除新文件；提交成功后只回收没有任何封面、摘记或精彩片段引用的旧资产。清理失败不回滚已提交的新封面，并使后续清理可重试。
- [ ] **步骤 4：运行相关测试与类型检查。** 运行上述测试及 `npx.cmd tsc --noEmit`；预期全绿。
- [ ] **步骤 5：提交。** `git add src/books/types.ts src/books/validation.ts src/books/sqliteRepository.ts tests/books`；`git commit -m "feat: persist and replace book covers"`。

### 任务 4：默认封面与新增／编辑界面

**文件：**

- 创建：`src/books/BookCover.tsx`、`src/books/BookCoverField.tsx`
- 修改：`src/books/AddBookForm.tsx`、`src/books/BookEditForm.tsx`、`src/books/BookCard.tsx`、`src/books/BookDetail.tsx`、`src/app/book/new.tsx`、`src/app/book/[id]/edit.tsx`
- 测试：`tests/books/BookCover.test.tsx`、`tests/books/BookCoverField.test.tsx`、`tests/books/addBook.test.tsx`、`tests/books/BookEditForm.test.tsx`、`tests/books/BookDetail.test.tsx`、`tests/books/bookRoutes.test.tsx`

**接口：**

- 消费：任务 1 的 `Book.coverUri`、任务 2 的图片暂存、任务 3 的 `coverSource`／`coverChange`。
- 产出：`BookCover({ title, uri, size }: { title: string; uri: string | null; size: 'card' | 'detail' | 'preview' })`；`BookCoverField({ title, initialUri, files, onChange }: { title: string; initialUri: string | null; files: BookCoverFiles; onChange: (change: BookEditInput['coverChange']) => void })` 回传保持、移除或暂存图片的选择，拥有并清理当前表单的暂存文件。新增页把 `set` 映射到 `BookInput.coverSource`。

- [ ] **步骤 1：编写失败的默认封面测试。** 书架和详情无图时显示各自书名；长书名最多三行且不会溢出；改名后默认封面文字同步更新；图片加载失败回退到带书名封面；封面文字不被屏幕阅读器重复播报。
- [ ] **步骤 2：编写失败的表单测试。** 只填书名可保存；相册取消、网络失败和编辑未保存返回时原封面不变并清理暂存；网络获取期间阻止重复获取；有效预览保存后在卡片、详情和重启后的读取结果一致。
- [ ] **步骤 3：运行测试确认红灯。** 运行 `npm.cmd test -- --runInBand tests/books/BookCover.test.tsx tests/books/BookCoverField.test.tsx tests/books/addBook.test.tsx tests/books/BookEditForm.test.tsx tests/books/BookDetail.test.tsx tests/books/bookRoutes.test.tsx`；预期新组件与交互断言失败。
- [ ] **步骤 4：实现两个组件和路由接入。** `BookCover` 对无图与失败使用同一默认样式，文字最多三行；`BookCoverField` 只在用户点击获取时请求网络，保存成功或卸载时清理暂存。表单继续支持软键盘滚动与现有错误提示，路由保存成功后刷新书架与详情。
- [ ] **步骤 5：运行界面测试和类型检查。** 运行上述测试及 `npx.cmd tsc --noEmit`；预期全绿。
- [ ] **步骤 6：提交。** `git add src/books src/app/book tests/books`；`git commit -m "feat: show and edit book covers"`。

### 任务 5：备份格式第 2 版及旧包兼容

**文件：**

- 修改：`src/backup/backupTypes.ts`、`src/backup/backupValidation.ts`、`src/backup/backupRepository.ts`、`src/backup/backupArchive.ts`、`src/backup/backupService.ts`
- 测试：`tests/backup/backupFixtures.ts`、`tests/backup/backupValidation.test.ts`、`tests/backup/backupRepository.test.ts`、`tests/backup/backupArchive.test.ts`、`tests/backup/backupService.test.ts`

**接口：**

- 产出：`BACKUP_FORMAT_VERSION = 2`、保留 `BackupManifestV1`，新增 `BackupManifestV2`。`validateBackupManifest(input: unknown): BackupManifestV2` 将第 1 版的每个 `coverImageId` 规范化为 `null`，对第 2 版校验 `coverImageId` 与图片 ID、所属书籍和实际图片字节。
- 消费：任务 1 的 `cover_image_id`、任务 3 的归属约束；现有 `BackupService` 和 `BackupArchive` 的对外操作签名不变。

- [ ] **步骤 1：编写失败的新旧格式测试。** 第 1 版无封面包完整恢复；第 2 版导出与恢复包含本地封面，和摘记共享的图片只打包一份；第 2 版封面 ID 缺失、错书归属、图片损坏或版本高于 2 时整包拒绝。断言验证不改输入。
- [ ] **步骤 2：运行测试确认红灯。** 运行 `npm.cmd test -- --runInBand tests/backup`；预期格式 2 与旧包兼容断言失败。
- [ ] **步骤 3：实现版本化格式与验证。** 导出写第 2 版；先按各自版本校验原始包，再把第 1 版规范化为封面为 `null` 的第 2 版对象，供既有恢复流程使用。第 2 版 `coverImageId` 只引用同书且已声明的图片；归档的完整性、大小、空间和失败回滚规则保持不变。
- [ ] **步骤 4：实现快照与事务恢复。** 快照包含封面关联；恢复先插入书籍与图片，再更新书籍的封面外键，避免循环引用的插入顺序问题。旧图路径仍由既有分代清理。
- [ ] **步骤 5：运行备份测试、类型检查和 iOS 打包检查。** 运行 `npm.cmd test -- --runInBand tests/backup`、`npx.cmd tsc --noEmit`、`npx.cmd expo export --platform ios --output-dir .expo-export-cover-check`；预期全绿。检查后只清理该命名的临时导出目录。
- [ ] **步骤 6：提交。** `git add src/backup tests/backup`；`git commit -m "feat: include covers in versioned backups"`。

### 任务 6：整体验证与真机验收说明

**文件：**

- 修改：`README.md`
- 测试：只补任务 1～5 尚未覆盖的跨层回归测试。

**接口：** 无新增产品接口；完成用户可执行的 iPhone Expo Go 验收步骤。

- [ ] **步骤 1：核对设计文档的全部验收项。** 逐项对照无图默认封面、相册、HTTPS、离线、失败回退、替换／移除、v1/v2 备份；仅对有缺口的跨层行为补测试。
- [ ] **步骤 2：更新 README。** 写清相册与图片链接操作、10 MiB 限制、默认封面的书名、离线本地副本，以及如何用旧备份和新备份做真机恢复验收。
- [ ] **步骤 3：运行一次完整验证。** 运行 `npm.cmd test -- --runInBand`、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`git diff --check`；预期全部通过。iPhone Expo Go 的实际下载、相册、离线显示和恢复步骤由用户在设备上确认；未确认时如实记录。
- [ ] **步骤 4：提交。** `git add README.md tests`；`git commit -m "docs: verify book cover flows"`。

## 集成边界

开发分支完成后先核对提交与工作树状态，再按用户当时的要求决定合并和上传；文档或自动测试通过不能替代 iPhone Expo Go 的实机验收。
