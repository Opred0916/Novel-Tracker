# 书库搜索与组合筛选 Implementation Plan

> **供执行者阅读：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项实施本计划。任务进度使用复选框（`- [ ]`）记录。

**目标：** 将书架查询下沉到本地 SQLite，支持搜索书名、作者、主角和摘记文字，并与阅读状态、作品类型及多个标签筛选组合使用。

**架构：** 新增只读的 `SqliteBookSearchRepository`，用参数化 SQL 查询满足条件的书籍 ID 和匹配摘记，再通过现有书籍仓储组装完整 `Book`。书架使用独立搜索状态 hook 处理防抖、竞态和失败保留旧结果；`BookCard` 仅在摘记促成匹配时显示摘要。

**技术栈：** Expo SDK 57、React Native、TypeScript、Expo SQLite、Jest、Testing Library React Native。

**设计文档：** `docs/superpowers/specs/2026-10-02-library-search-and-filtering-design.md`

## 全局约束

- 关键词搜索只覆盖书名、作者、主角和摘记“我的想法”；作品类型、标签和阅读状态只能作为筛选条件。
- 多个关键词全部满足，但允许分别命中不同搜索字段；中文连续包含匹配，英文不区分大小写。
- `%`、`_` 和反斜杠按普通文字处理，所有 SQL 使用参数绑定。
- 阅读状态和作品类型单选；多个标签必须全部拥有；关键词与全部筛选条件同时满足。
- 结果按 `updated_at DESC, id ASC` 排序，同一本书只返回一次，同名不同 ID 的书分别返回。
- 查询失败保留输入、筛选和上一批成功结果；旧异步查询不能覆盖新查询。
- 本功能只读，不修改数据库结构和版本，不引入 FTS、原生依赖、OCR、联网搜索或搜索历史。
- 进入详情再返回保留当前条件，App 重启后恢复默认。

## 文件分工

- `src/books/bookSearch.ts`：搜索输入类型、关键词标准化、LIKE 转义和摘记摘要纯函数。
- `src/books/bookSearchRepository.ts`：参数化 SQLite 组合查询、书籍组装和匹配摘记摘要。
- `src/books/useBookSearch.ts`：防抖、请求竞态、重试和失败保留旧结果。
- `src/storage/AppProvider.tsx`：创建并提供搜索仓储。
- `src/books/BookCard.tsx`：可选显示匹配摘记摘要。
- `src/app/index.tsx`：连接搜索仓储、筛选控件、加载／失败／无结果和清除操作。
- `tests/books/bookSearch.test.ts`、`tests/books/bookSearchRepository.test.ts`、`tests/books/useBookSearch.test.tsx`、`tests/books/bookRoutes.test.tsx`：纯函数、SQLite、异步状态与页面集成测试。

## Review Focus

- 查询中的 `%`、`_`、反斜杠和单引号必须按普通文字匹配，不能扩大结果或破坏 SQL；测试放在 `bookSearchRepository.test.ts`。
- 标签和作品类型名称不能被关键词搜索命中，但作为筛选条件仍有效；测试放在 `bookSearchRepository.test.ts`。
- 快速输入时较慢的旧请求不得覆盖较新的结果；测试放在 `useBookSearch.test.tsx`。
- 查询失败必须保留上一批结果和当前条件，重试成功后才能替换；测试放在 `useBookSearch.test.tsx`。
- 多条摘记或多个标签关联不能让一部小说重复显示，同名不同 ID 不能合并；测试放在 `bookSearchRepository.test.ts`。

---

### 任务 1：搜索类型与纯函数

**文件：**

- 创建：`src/books/bookSearch.ts`
- 测试：`tests/books/bookSearch.test.ts`

**接口：**

- `BookSearchFilters { query: string; status: BookStatus | null; bookType: BookType | null; tagIds: string[] }`
- `BookSearchResult { book: Book; matchedNoteSnippet: string | null }`
- `normalizeSearchTerms(query: string): string[]`
- `escapeLikeTerm(term: string): string`
- `buildNoteSnippet(body: string, matchedTerm: string, maxLength?: number): string`

- [ ] **步骤 1：编写失败测试。** 覆盖首尾／连续空白、多关键词顺序、英文小写标准化、空查询、`%`／`_`／反斜杠转义，以及关键词位于摘记开头、中间、结尾时不超过默认 60 个字符的摘要。
- [ ] **步骤 2：运行测试确认失败。**

运行：`npm test -- --runInBand tests/books/bookSearch.test.ts`

预期：模块不存在或导出函数不存在。

- [ ] **步骤 3：实现纯函数和类型。** `normalizeSearchTerms` 使用 Unicode 文本的 `toLocaleLowerCase()`；摘要保留关键词附近文字，只在截断处增加省略号，不修改原正文。
- [ ] **步骤 4：运行测试和类型检查。**

运行：`npm test -- --runInBand tests/books/bookSearch.test.ts`、`npx tsc --noEmit`

预期：全部通过。

- [ ] **步骤 5：提交。**

```bash
git add src/books/bookSearch.ts tests/books/bookSearch.test.ts
git commit -m "feat: define local book search rules"
```

### 任务 2：SQLite 搜索仓储

**文件：**

- 创建：`src/books/bookSearchRepository.ts`
- 修改：`src/storage/AppProvider.tsx`
- 测试：`tests/books/bookSearchRepository.test.ts`

**接口：**

- `SqliteBookSearchRepository(db: Database, books: BookRepository)`
- `search(filters: BookSearchFilters): Promise<BookSearchResult[]>`
- `useBookSearchRepository(): SqliteBookSearchRepository`

- [ ] **步骤 1：编写失败的 SQLite 集成测试。** 建立包含书籍、主角、标签和摘记的 v6 内存库，分别断言书名、作者、主角和摘记命中；类型或标签名称单独作为关键词不命中。
- [ ] **步骤 2：补充组合与边界测试。** 覆盖作者＋摘记的多关键词、状态＋类型＋两个标签组合、特殊字符、英文大小写、空查询、稳定排序、重复去重和同名不同 ID。
- [ ] **步骤 3：运行测试确认失败。**

运行：`npm test -- --runInBand tests/books/bookSearchRepository.test.ts`

预期：仓储模块不存在或搜索断言失败。

- [ ] **步骤 4：实现参数化查询。** 每个关键词生成一组书名、作者、主角和摘记 `LIKE ? ESCAPE '\\'` 条件；关键词组之间使用 `AND`。状态和类型使用等值条件；标签用 `COUNT(DISTINCT tag_id)` 确保全部拥有。
- [ ] **步骤 5：组装结果和摘要。** 按查询到的稳定 ID 顺序调用现有 `BookRepository.get(id)`；仅当书籍资料未独立满足全部关键词且摘记参与匹配时，用第一条相关摘记生成 `matchedNoteSnippet`。
- [ ] **步骤 6：注入 Provider。** 搜索仓储与现有书籍仓储共享同一数据库连接；初始化失败仍由 AppProvider 的现有错误状态处理。
- [ ] **步骤 7：运行仓储测试和类型检查。**

运行：`npm test -- --runInBand tests/books/bookSearchRepository.test.ts`、`npx tsc --noEmit`

预期：全部通过。

- [ ] **步骤 8：提交。**

```bash
git add src/books/bookSearchRepository.ts src/storage/AppProvider.tsx tests/books/bookSearchRepository.test.ts
git commit -m "feat: search books and notes in sqlite"
```

### 任务 3：防抖与异步查询状态

**文件：**

- 创建：`src/books/useBookSearch.ts`
- 测试：`tests/books/useBookSearch.test.tsx`

**接口：**

- `useBookSearch(repository, filters, options?: { debounceMs?: number })`
- 返回 `{ results, loading, error, retry }`；`retry(): void` 使用当前条件重新查询。

- [ ] **步骤 1：编写失败 hook 测试。** 使用假计时器验证默认 250ms 防抖、连续输入只提交最后条件、旧慢请求不覆盖新快请求、卸载后不更新状态。
- [ ] **步骤 2：编写失败恢复测试。** 首次成功后下一次查询失败，断言旧结果仍在且 `error === '搜索失败，请重试'`；调用 `retry` 后成功替换结果。
- [ ] **步骤 3：运行测试确认失败。**

运行：`npm test -- --runInBand tests/books/useBookSearch.test.tsx`

预期：hook 不存在或状态断言失败。

- [ ] **步骤 4：实现 hook。** 用稳定的筛选键、防抖计时器和递增请求序号管理查询；只允许最新且组件仍挂载的请求更新状态。
- [ ] **步骤 5：运行 hook 测试和类型检查。**

运行：`npm test -- --runInBand tests/books/useBookSearch.test.tsx`、`npx tsc --noEmit`

预期：全部通过。

- [ ] **步骤 6：提交。**

```bash
git add src/books/useBookSearch.ts tests/books/useBookSearch.test.tsx
git commit -m "feat: manage debounced library search"
```

### 任务 4：书架页面与匹配摘记提示

**文件：**

- 修改：`src/books/BookCard.tsx`
- 修改：`src/app/index.tsx`
- 修改：`tests/books/bookRoutes.test.tsx`
- 新增或修改：`tests/books/BookCard.test.tsx`

**接口：**

- `BookCard({ book, matchedNoteSnippet?, onPress })`
- 书架通过 `useBookSearchRepository()` 和 `useBookSearch()` 获取 `BookSearchResult[]`，不再调用 `filterBooks(repo.list())`。

- [ ] **步骤 1：编写失败的书卡测试。** 有摘要时显示“匹配摘记”和摘要正文；`null` 时保持当前书卡信息密度，不显示占位标题。
- [ ] **步骤 2：编写失败的书架集成测试。** 验证新搜索提示文字、完整条件提交、筛选数量、清除全部条件、进入详情再返回时条件保留、查询加载不清空旧列表、失败提示与重试，以及无结果页的“清除筛选”。
- [ ] **步骤 3：实现书卡摘要。** 摘要显示在作者下方，限制行数且不改变点击整张卡片进入详情的行为。
- [ ] **步骤 4：替换书架数据流。** 保留当前筛选 UI，将条件交给 hook；标签列表仍由 `TagRepository` 读取。显示加载、失败、重试、空书架和无结果状态。
- [ ] **步骤 5：实现清除与返回保留。** 清除时恢复空关键词、全部状态、全部类型和零标签；不把条件写入数据库或持久化存储。
- [ ] **步骤 6：运行页面和回归测试。**

运行：`npm test -- --runInBand tests/books/BookCard.test.tsx tests/books/bookRoutes.test.tsx tests/books/bookSearchRepository.test.ts tests/books/useBookSearch.test.tsx`

预期：全部通过。

- [ ] **步骤 7：提交。**

```bash
git add src/books/BookCard.tsx src/app/index.tsx tests/books/BookCard.test.tsx tests/books/bookRoutes.test.tsx
git commit -m "feat: add searchable filtered bookshelf"
```

### 任务 5：完整验证与真机验收准备

**文件：**

- 修改：必要的测试或文档（仅修复本功能发现的问题）

- [ ] **步骤 1：运行完整自动化验证。**

运行：`npm test -- --runInBand`、`npx tsc --noEmit`、`npm run lint`

预期：全部测试、TypeScript 和 lint 通过；不重复运行 Expo Doctor，除非出现依赖或打包异常。

- [ ] **步骤 2：复核只读保证。** 搜索前后比较书籍、标签、摘记和阅读记录数量及内容，确认查询没有写入或迁移数据库。
- [ ] **步骤 3：准备 iPhone 验收清单。** 验证中文书名、英文作者、主角、摘记搜索；选择两个标签；叠加状态和类型；进入详情返回；清除筛选；无结果与查询失败提示。
- [ ] **步骤 4：提交收尾修复。** 如果步骤 1～3 无文件变更则不创建空提交；如有修复，使用：

```bash
git add src tests docs
git commit -m "test: verify library search and filtering"
```
