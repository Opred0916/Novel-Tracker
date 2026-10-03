# 删除小说 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从小说详情页安全删除一本书及其关联记录和本地图片，不影响其他书、全局标签或已有备份。

**Architecture:** `SqliteBookRepository.delete` 在一个 SQLite 事务中删除书籍及级联记录，并把该书图片路径写入持久清理队列；`ImageDeletionQueue` 在提交后和应用下次启动时清理已无引用的应用私有图片。详情页负责二次确认、处理中状态、错误提示及返回书架，不直接操作 SQL 或文件。

**Tech Stack:** Expo SDK 57、React Native、TypeScript、Expo Router、Expo SQLite、现有 Expo FileSystem、Jest、Testing Library React Native。无需新增依赖或修改备份格式。

**Spec:** `docs/superpowers/specs/2026-10-02-book-deletion-design.md`

## Global Constraints

- 数据库从 `user_version = 7` 增量升级到 8；只新增内部 `pending_image_deletions` 表，不重建或清空现有数据。
- 删除前显示书名与关联内容并二次确认；取消时不得修改数据或文件；删除后无法在应用内撤销。
- 主角、书籍标签关联、阅读历史、摘记、封面、精彩片段及该书图片资产随书删除；`tags`、`quick_tags`、其他书及手机相册原图保留。
- 图片清理必须在数据库提交之后，只能删除应用管理且当前数据库已不引用的具体文件；文件清理失败不得把已删除的书恢复或报告为数据库删除失败。
- `pending_image_deletions` 不进入 `.noveltracker` 备份；已导出的备份不变，新备份不再包含被删除的书。恢复仍是完整替换。
- 不做批量删除、回收站、应用内撤销、自动备份、全局编辑锁或新原生依赖。
- Windows PowerShell 使用 `npm.cmd` 和 `npx.cmd`。每项只跑相关测试；最终跑受影响测试、TypeScript 与 lint，不重复跑 Expo Doctor 或 iOS 导出。真机验收由用户在 iPhone Expo Go 完成。

## 文件分工

- `src/storage/database.ts`：新增 `pending_image_deletions(local_path TEXT PRIMARY KEY NOT NULL)`，更新迁移版本为 8。
- `src/books/imageDeletionQueue.ts`：封装图片安全路径检查、事务内入队、提交后与启动时的幂等清理；文件删除接口可注入以便测试。
- `src/books/repository.ts`、`src/books/sqliteRepository.ts`：新增 `delete(id: string): Promise<void>`；检查跨书图片引用、事务删除和清理触发。
- `src/storage/AppProvider.tsx`：为书籍仓储注入同一个清理服务，并在数据库打开后重试未完成任务。
- `src/app/book/[id].tsx`：详情页底部危险操作入口、确认框、繁忙状态、错误和导航。
- `tests/books/migration.test.ts`、新建 `tests/books/imageDeletionQueue.test.ts`、`tests/books/sqliteRepository.test.ts`、`tests/books/bookRoutes.test.tsx`、`tests/backup/backupRepository.test.ts`、`tests/backup/backupArchive.test.ts`：对应迁移、队列、级联事务、界面和备份边界。
- `README.md`：补充删除不可撤销、旧备份可能恢复已删书且恢复会完整替换的说明。

## Review Focus

- 路径看似位于图片目录但包含 `..`、编码后的穿越、相似前缀或非 `file:` 协议时，清理器不得删除；任务 1 的路径测试覆盖。
- 数据库提交后 App 退出、文件暂时无法删除或文件已经不存在时，任务应可幂等重试；任务 1 的重启／故障测试覆盖。
- 待删图片 ID 被另一书的封面、摘记或精彩片段错误引用，或另一书资产共用同一路径时，应拒绝整次删除；任务 2 的跨书测试覆盖。
- 数据库事务在级联删除中失败时，书、关联记录及图片文件必须保留，清理队列不得残留；任务 2 的回滚测试覆盖。
- 备份快照取得路径后图片被删除时，导出必须失败并清除不完整的目标包；任务 2 的归档测试覆盖。
- 点击取消、连续点击确认、数据库报错、删除后从旧链接再进详情时，不得误报成功或显示过时内容；任务 3 的路由测试覆盖。

---

### 任务 1：持久图片清理队列与数据库迁移

**文件：**

- 创建：`src/books/imageDeletionQueue.ts`、`tests/books/imageDeletionQueue.test.ts`
- 修改：`src/storage/database.ts`、`tests/books/migration.test.ts`

**Interfaces:**

- 产出：`ImageDeletionFilePort = { removeFile(localPath: string): Promise<void> }`；`new ImageDeletionQueue(db: Database, files?: ImageDeletionFilePort, managedRoots?: readonly string[])`，默认从现有 Expo 文件目录获得允许根目录。
- 产出：`ImageDeletionQueue.enqueue(txn: Pick<Database, 'runAsync'>, paths: readonly string[]): Promise<void>`；在调用方的现有事务内以路径去重入队。
- 产出：`ImageDeletionQueue.drain(): Promise<void>`；仅清理仍在队列、当前 `image_assets.local_path` 未引用、且属于应用图片目录的文件。移除成功或文件已不存在后删除队列项；失败或路径不安全时保留。
- 产出：可注入的 `{ removeFile(localPath: string): Promise<void> }` 和允许根目录，默认复用现有文件存储，允许 `novel-tracker/<bookId>/` 与 `novel-tracker-restored-images/<generation>/images/` 中的文件，不允许暂存、备份包或其他位置。
- 消费方：任务 2 的删除事务与任务 2 的启动重试。

- [ ] **步骤 1：编写失败的迁移测试。** 在新库及含书、封面和摘记的 v7 库上各运行两次 `migrateDatabase`；断言 `PRAGMA user_version` 为 8、队列表存在且原数据不变。
- [ ] **步骤 2：编写失败的队列测试。** 断言重复路径只入队一次；有效书籍图片和备份恢复图片可删除；被 `image_assets` 引用的路径、不安全 URI 和共享路径不删除；删除失败后队列保留，新实例 `drain()` 能重试；文件已不存在视为成功。
- [ ] **步骤 3：运行测试确认红灯。** `npm.cmd test -- --runInBand tests/books/migration.test.ts tests/books/imageDeletionQueue.test.ts`；预期版本 8／新服务相关断言失败。
- [ ] **步骤 4：实现迁移和清理服务。** 更新 `migrateDatabase(db): Promise<void>`；队列按路径主键去重。路径检查须拒绝非 `file:` URI、越界段、查询／片段及相似前缀，按目录边界判断；清理前重新查询当前图片引用，并逐项处理以免一个失败阻断其他任务。
- [ ] **步骤 5：运行相关测试和类型检查。** 同步骤 3 的命令，加 `npx.cmd tsc --noEmit`；预期通过。
- [ ] **步骤 6：提交。** `git add src/storage/database.ts src/books/imageDeletionQueue.ts tests/books/migration.test.ts tests/books/imageDeletionQueue.test.ts`；`git commit -m "feat: queue safe image deletion"`。

### 任务 2：删除书籍及关联数据的事务

**文件：**

- 修改：`src/books/repository.ts`、`src/books/sqliteRepository.ts`、`src/storage/AppProvider.tsx`
- 测试：`tests/books/sqliteRepository.test.ts`、`tests/backup/backupRepository.test.ts`、`tests/backup/backupArchive.test.ts`

**Interfaces:**

- 消费：任务 1 的 `ImageDeletionQueue.enqueue`、`drain`；`SqliteBookRepository` 构造函数在现有 `db, idFactory?, todayFactory?, coverFiles?` 之后增加可选的 `deletionQueue?: ImageDeletionQueue`，既有调用继续有效。
- 产出：`BookRepository.delete(id: string): Promise<void>`；找不到书时报“找不到这本小说”，事务失败时抛错；事务成功后即使文件清理暂时失败也视为删除成功。
- 产出：`AppProvider` 创建并注入同一个队列实例，数据库就绪后触发一次启动重试；清理异常不能阻止书架打开。
- 消费方：任务 3 的详情页按钮。

- [ ] **步骤 1：编写失败的删除测试。** 为甲书设置封面、二刷、主角、标签、多条摘记及复用图片，另建乙书；调用 `delete('甲书ID')` 后断言甲书及所有关联行消失、甲书图片只入队／删除一次，乙书、全局标签和快捷标签保持。
- [ ] **步骤 2：编写失败的安全与回滚测试。** 断言不存在的 ID 报错；甲书图片被乙书引用或路径被乙书资产共用时整次拒绝；注入 SQL 失败时书、子记录、图片文件不变且队列为空；注入文件删除失败时 `delete` 仍成功、队列保留。
- [ ] **步骤 3：编写失败的备份边界测试。** `SqliteBackupRepository.createSnapshot(appVersion, exportedAt)` 在删除前含甲书、删除后不含甲书及图片，但保留乙书；队列不出现在快照。旧的快照对象不因删除而被改写。
- [ ] **步骤 4：编写失败的并发导出测试。** 用 `BackupArchive` 的文件端口模拟快照完成后、读取图片前文件消失，断言 `write` 拒绝并清除不完整的目标归档；既有保护若已满足测试，保留测试而不改归档实现。
- [ ] **步骤 5：运行测试确认红灯。** `npm.cmd test -- --runInBand tests/books/sqliteRepository.test.ts tests/backup/backupRepository.test.ts tests/backup/backupArchive.test.ts`；预期缺失 `delete` 或新断言失败。
- [ ] **步骤 6：实现仓储事务与启动重试。** 在事务中验证图片 ID 和路径没有跨书共享，收集路径，清空本书 `cover_image_id`，入队并删除 `books` 行；使用既有外键级联，不删 `tags`／`quick_tags`。提交后调用队列清理；`AppProvider` 启动时重试，不让清理错误阻断初始化。
- [ ] **步骤 7：运行相关测试和类型检查。** 同步骤 5 的命令，加 `npx.cmd tsc --noEmit`；预期通过。
- [ ] **步骤 8：提交。** `git add src/books/repository.ts src/books/sqliteRepository.ts src/storage/AppProvider.tsx tests/books/sqliteRepository.test.ts tests/backup/backupRepository.test.ts tests/backup/backupArchive.test.ts`；`git commit -m "feat: delete books and related records"`。

### 任务 3：详情页交互、说明与验收

**文件：**

- 修改：`src/app/book/[id].tsx`、`tests/books/bookRoutes.test.tsx`、`README.md`

**Interfaces:**

- 消费：任务 2 的 `useBooks().delete(id): Promise<void>`；书架现有 `useFocusEffect` 在返回时重新执行搜索，无需新增全局状态。
- 产出：详情页底部“删除小说”按钮，二次确认后删除并 `router.replace('/')`；失败停留详情并允许重试。

- [ ] **步骤 1：编写失败的路由测试。** 点击删除只弹出含《书名》及阅读记录、摘记、精彩片段、封面影响范围的确认框；取消不调用仓储；确认后只调用一次 `delete(id)`，等待成功才返回书架；重复点击不重复删除。
- [ ] **步骤 2：补失败与旧链接测试。** `delete` 拒绝时显示“删除失败，请重试”，不导航，按钮恢复可用；再次成功可返回；`repo.get(id)` 为 `null` 时沿用“找不到这本小说”入口。返回书架后的焦点刷新不保留被删卡片或摘记搜索结果。
- [ ] **步骤 3：运行测试确认红灯。** `npm.cmd test -- --runInBand tests/books/bookRoutes.test.tsx`；预期按钮或交互断言失败。
- [ ] **步骤 4：实现界面并更新 README。** 危险操作按钮位于“编辑资料”之后；使用 `Alert.alert` 二次确认，处理中禁用重复操作，成功后返回书架；说明删除不可在应用内撤销，旧备份仍可能包含该书，恢复会完整替换书库。
- [ ] **步骤 5：运行必要验证。** `npm.cmd test -- --runInBand tests/books/migration.test.ts tests/books/imageDeletionQueue.test.ts tests/books/sqliteRepository.test.ts tests/books/bookRoutes.test.tsx tests/backup/backupRepository.test.ts tests/backup/backupArchive.test.ts`、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`git diff --check`；预期均通过。无需重复跑 Expo Doctor 或 iOS 导出。
- [ ] **步骤 6：提交。** `git add src/app/book/[id].tsx tests/books/bookRoutes.test.tsx README.md`；`git commit -m "feat: confirm book deletion in detail view"`。
- [ ] **步骤 7：记录真机验收。** 请用户在 iPhone Expo Go 上分别取消、确认删除一本测试书，检查其他书和标签仍在、重新打开 App 后结果不变；未收到实机反馈时不得声称已验证。

## 集成边界

计划实施完成后先核对工作树、提交和实际验证结果；合并、推送 GitHub 或删除用户数据都按用户届时的明确要求执行。旧备份本身不被这项功能改写。
