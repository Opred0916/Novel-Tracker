# 书架批量整理 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task, or `superpowers:subagent-driven-development` if the user explicitly chooses delegation. Steps use checkbox (`- [ ]`) syntax for tracking. Read the spec first.

**Goal / 目标：** 在书架明确选中多本小说，批量添加／移除标签及设置／清空作品类型，预览后一次提交，失败时整批回滚。

**Architecture / 架构：** 用纯函数计算每本书的修改前后状态及影响数量；独立的 SQLite 仓储读取预览，并在独占事务内复核快照、创建自定义标签和提交变化。书架维护按书籍 ID 的临时选择，编辑与预览组件负责用户确认；搜索、筛选、排序和现有单书编辑继续使用原有数据。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、Expo SQLite、Jest；Windows PowerShell 使用 `npm.cmd`／`npx.cmd`。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-04-bookshelf-bulk-organization-design.md`

## Global Constraints / 全局约束

- 只修改已选书的标签和作品类型；不改阅读状态、日期、次数、评分、摘记、图片或未选中书。不新增网络服务、数据库字段或备份／开放导出版本。
- 已选集合按稳定书籍 ID 保存；改变搜索／筛选／排序不自动增减选择。“全选当前结果”只选完成当前查询的结果，不能使用仍在显示的旧结果。
- 添加标签保留已有标签顺序并在末尾追加；移除只删除指定标签。作品类型明确区分保持、设为五种之一和清空；同一标签不能同时添加和移除。
- 自定义标签先留在草稿中，与所有书籍修改一起成功或回滚。仅实际变化的书更新 `updated_at`；全部无变化时禁用确认。
- 保存前复核预览的 `updated_at`、作品类型和标签；删除或改变的书使本批停止并重新预览。一次事务提交整批，不发生部分成功。
- iPhone 真机验收由用户完成；未实测不声称通过。只运行与改动有关的定向测试，收尾做一次类型检查、lint 和差异检查。

## Review Focus

- 筛选变更后的防抖空窗仍显示旧书卡：全选及点卡选书不能把旧查询结果当成当前结果；任务 3 测试覆盖。
- 同名小说、跨筛选隐藏已选书：预览须按 ID 保持各自归属，用户能在已选列表中移除隐藏项；任务 3、4 测试覆盖。
- 大批量选书超过 SQLite 常见单条语句参数数目：读取与复核需分批绑定 ID，保存仍是一个事务；任务 2 测试覆盖。
- 新标签名称只有大小写或空白差异，以及与系统标签重名：预览拒绝，不能留下孤立标签；任务 1、2 测试覆盖。
- 保存过程中书或标签变动、任一中途写入失败或用户连点确认：整批回滚或仅执行一次，草稿留在页面供重新预览；任务 2、4 测试覆盖。

---

## 文件分工

- 新建 `src/books/bulkOrganize.ts`：操作类型、快照／预览类型、校验和纯变化计算；新建 `tests/books/bulkOrganize.test.ts`。
- 新建 `src/books/bulkOrganizeRepository.ts`：批量读取、生成预览、事务内复核及写入；新建 `tests/books/bulkOrganizeRepository.test.ts`。修改 `src/storage/AppProvider.tsx` 提供仓储 hook。
- 修改 `src/books/useBookSearch.ts`，提供“结果与当前查询条件一致”的状态；修改 `src/books/BookCard.tsx` 和 `src/app/index.tsx` 接入选择模式。扩展 `tests/books/useBookSearch.test.tsx`、`tests/books/bookRoutes.test.tsx`。
- 新建 `src/books/BulkOrganizePanel.tsx`：已选列表、标签／类型操作、预览和确认；新建 `tests/books/BulkOrganizePanel.test.tsx`。修改 `README.md` 说明批量整理入口。

### 任务 1：操作模型与纯预览计算

**文件：** 新建 `src/books/bulkOrganize.ts`、`tests/books/bulkOrganize.test.ts`。

**Interfaces:** `BulkTypeChange = { kind: 'keep' } | { kind: 'set'; value: BookType } | { kind: 'clear' }`；`BulkOrganizeDraft = { addTagIds: string[]; removeTagIds: string[]; newTags: { id: string; name: string }[]; typeChange: BulkTypeChange }`；`BulkBookSnapshot = { id: string; title: string; author: string | null; updatedAt: string; bookType: BookType | null; tagIds: string[] }`。`BulkOrganizePreview = { draft: BulkOrganizeDraft; items: { before: BulkBookSnapshot; after: { bookType: BookType | null; tagIds: string[] }; addedTagIds: string[]; removedTagIds: string[]; typeChanged: boolean; changed: boolean }[]; selectedCount: number; changedCount: number; unchangedCount: number; addAffectedBookCount: number; removeAffectedBookCount: number; typeAffectedBookCount: number }`。`calculateBulkPreview(books: BulkBookSnapshot[], tags: Tag[], draft: BulkOrganizeDraft): BulkOrganizePreview` 返回上述只读快照，不修改输入。

- [ ] **步骤 1：写失败测试。** 两书原标签分别为 `[古代, 悬疑]` 与 `[现代]` 时，“加现代、移悬疑”得到 `[古代, 现代]` 与 `[现代]`；新增顺序稳定，不更改输入。类型 `keep`、`set: other`、`clear` 各有正确前后值；同书多个操作只计一个 `changedCount`，分项数量按受影响书数计算。
- [ ] **步骤 2：补边界测试。** 去重后的同一标签既加又移、空操作、空 ID／重名自定义标签、与现有标签重名，以及把新标签放到“移除”而非“添加”均拒绝；仅做无效重复添加时 `changedCount=0`；自定义标签的去首尾空白名称出现在“添加”预览，未写入全局库。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/books/bulkOrganize.test.ts`；预期新模块缺失或新增断言失败。
- [ ] **步骤 4：实现纯函数。** 用标签 ID 计算差异，保留旧顺序并将新增项追加；新标签名称去首尾空白并按现有标签名称唯一规则校验。输入和输出不共享可变标签数组；不访问数据库。
- [ ] **步骤 5：绿灯并提交。** 重跑步骤 3，预期通过；提交 `feat: calculate bookshelf bulk changes`。

### 任务 2：预览读取与事务提交

**文件：** 新建 `src/books/bulkOrganizeRepository.ts`、`tests/books/bulkOrganizeRepository.test.ts`；修改 `src/storage/AppProvider.tsx`。

**Interfaces:** `SqliteBulkOrganizeRepository.preview(bookIds: string[], draft: BulkOrganizeDraft): Promise<BulkOrganizePreview>` 从现有表读取最新快照并调用任务 1 的纯函数；`apply(preview: BulkOrganizePreview): Promise<{ changedCount: number }>` 在独占事务中复核并写入。`useBulkOrganizeRepository(): SqliteBulkOrganizeRepository` 从 AppProvider 取得同一数据库实例。

- [ ] **步骤 1：写失败仓储测试。** 三书中只选两书，预览和提交后的类型／标签与任务 1 一致；未选中书及其阅读历史、摘记不变。对已有标签无效重复添加和类型保持，`updated_at` 不变；实际变化书更新修改时间。新增自定义标签在成功后可从 `tags` 查到，`quick_tags` 不变。
- [ ] **步骤 2：补冲突与回滚测试。** 预览后更改单书 `updated_at`、类型或标签，或删除书／标签，`apply` 报过期且不修改任何目标；用 SQLite 触发器令第二本书写入失败，验证第一本和新标签也回滚。重名自定义标签及伪造 ID 在事务中再次拒绝。用超过 999 个书籍 ID、并令测试数据库拒绝单次超过 400 个绑定参数，验证分批读取与复核，仍只进行一次事务。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/books/bulkOrganizeRepository.test.ts`；预期仓储或 hook 缺失。
- [ ] **步骤 4：实现仓储及 hook。** 对选中 ID 去重，用每批最多 400 个绑定参数读取书与 `book_tags`；事务开始后复核快照与标签库，并用当前数据重新计算计划，不能信任调用方传入的 `after`。再插入自定义标签、更新有变化的书及标签关联。只对受影响的书重排连续 `position`；不调用单书 `update`，避免触发阅读状态逻辑。向页面区分“预览已过期”和一般保存失败。
- [ ] **步骤 5：绿灯并提交。** 重跑步骤 3，预期通过；提交 `feat: save bookshelf bulk changes atomically`。

### 任务 3：书架按 ID 选书

**文件：** 修改 `src/books/useBookSearch.ts`、`src/books/BookCard.tsx`、`src/app/index.tsx`、`tests/books/useBookSearch.test.tsx`、`tests/books/bookRoutes.test.tsx`。

**Interfaces:** `useBookSearch(...)` 增加 `resultsCurrent: boolean`，仅当最后成功返回的结果属于当前查询条件且没有搜索错误时为真；比较当前条件与最后成功查询的键，在防抖计时期间也立即转为 false。书卡增加可选 `selection: { checked: boolean; onToggle(): void }`，存在时以复选语义替代进入详情。书架用 `Map<string, { title: string; author: string | null }>` 保留选择及“查看已选”的辨认信息，退出整个流程才清空。

- [ ] **步骤 1：写失败测试。** 输入新关键词后的防抖时间和查询进行中，旧结果仍可见但 `resultsCurrent=false`；查询失败也为 false，成功返回最新结果才为 true。快速连续筛选时旧 Promise 返回不能把 `resultsCurrent` 置真。
- [ ] **步骤 2：补页面测试。** 进入“批量整理”后书卡为带勾选状态的复选项而非详情按钮；手选两书、切换筛选及排序后仍保留两个 ID；“查看已选”可移除隐藏书。全选仅取当前完成查询的 ID，旧结果加载中／失败时禁用；取消流程或离开书架导航后清空选择并恢复正常详情导航，避免从恢复备份页返回时沿用旧选择；在书架内从预览返回则保留选择。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/books/useBookSearch.test.tsx tests/books/bookRoutes.test.tsx`；预期新状态或选择入口断言失败。
- [ ] **步骤 4：接入选择模式。** 用搜索条件与结果来源状态控制书卡选择和全选，不能依赖现有 `loading` 单独判断防抖空窗；选择由稳定 ID 决定，列表排序和筛选不重排选择。保留原本的搜索命中提示、空状态和非选择模式导航。
- [ ] **步骤 5：绿灯并提交。** 重跑步骤 3，预期通过；提交 `feat: select bookshelf books across filters`。

### 任务 4：批量操作、逐本预览与确认

**文件：** 新建 `src/books/BulkOrganizePanel.tsx`、`tests/books/BulkOrganizePanel.test.tsx`；修改 `src/app/index.tsx`、`tests/books/bookRoutes.test.tsx`、`README.md`。

**Interfaces:** `BulkOrganizePanel` 接收 `{ selectedBooks: Map<string, { title: string; author: string | null }>; tags: Tag[]; repository: SqliteBulkOrganizeRepository; onComplete(): void; onCancel(): void }`；内部持有 `BulkOrganizeDraft` 与 `BulkOrganizePreview | null`。新增自定义标签时在草稿里产生稳定 ID，只有 `repository.apply(preview)` 才能持久化。书架 `onComplete` 清空选择并触发 `useBookSearch.retry()` 和全局标签列表刷新。

- [ ] **步骤 1：写失败组件测试。** 分别选择“添加标签”“移除标签”“作品类型保持／设为其他／清空”；同一标签不能双向操作，空操作不能预览。创建自定义标签、退出前 `tagRepo.create` 和仓储 `apply` 均未调用；预览显示选中／改变／不变本数及每本前后值，同名书有作者辅助辨认；全无变化禁用最终确认。
- [ ] **步骤 2：补确认与失败测试。** 返回操作页保留已选书和草稿，取消不调用 `apply`；确认仅调用一次。过期预览提示重新生成并保留选择，普通失败可重试且不显示成功；成功后退出模式、重查书架及标签库，筛选结果变化和排序刷新正常。
- [ ] **步骤 3：运行红灯。** `npm.cmd test -- --runInBand tests/books/BulkOrganizePanel.test.tsx tests/books/bookRoutes.test.tsx`；预期组件或交互缺失。
- [ ] **步骤 4：实现操作与预览。** 完整标签库分开选择添加／移除；自定义标签沿用单书编辑的草稿式创建，不提前调用全局 `tagRepo.create`。预览为可滚动完整列表，显示每书的前后标签及类型；提交时禁用重复按钮，明确呈现冲突与错误。更新 README 的入口和限制。
- [ ] **步骤 5：绿灯并提交。** 重跑步骤 3，预期通过；提交 `feat: review and confirm bookshelf bulk organization`。

### 任务 5：集中验证与真机交接

**文件：** 只在发现本功能缺陷时修改相应文件；不另开功能。

- [ ] **步骤 1：定向回归。** 运行 `npm.cmd test -- --runInBand tests/books/bulkOrganize.test.ts tests/books/bulkOrganizeRepository.test.ts tests/books/BulkOrganizePanel.test.tsx tests/books/useBookSearch.test.tsx tests/books/bookRoutes.test.tsx tests/books/sqliteRepository.test.ts tests/books/tagRepository.test.ts`；再运行 `npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache` 与 `git diff --check`。失败时只扩大到相关测试定位。
- [ ] **步骤 2：iPhone 验收清单。** 准备三本类型不同、标签有重叠的书；筛选选两本，换条件补选一本并在“查看已选”移除隐藏书；先取消再提交。核对逐本前后预览、筛选结果变化、最近修改排序与详情资料。故意退出预览后不应写库；事务失败通过任务 2 的受控故障测试核对，若无可注入失败的真机测试构建，则将该项标为“真机未验证”。
- [ ] **步骤 3：交接。** 核对提交和工作区状态；是否合并并上传按用户后续要求执行。
