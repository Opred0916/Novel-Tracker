# 想读随机抽一本 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL: Use `superpowers:executing-plans`, or use `superpowers:subagent-driven-development` only if the user explicitly chooses delegation. Steps use checkbox (`- [ ]`) syntax. Read the spec first.

**Goal / 目标：** 在书架轻松从整个“想读”集合随机抽出一本，查看资料或重抽。

**Architecture / 架构：** 纯函数负责等概率候选选择；书架通过现有 `BookRepository.list()` 每次读取最新记录。独立弹层负责展示与交互，不持久化抽取历史，也不改变书籍数据。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、Expo SQLite、Jest。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-04-reading-discovery-and-recap-design.md` 的第一节和共用约束。

## Global Constraints / 全局约束

- 只抽当前状态为 `want_to_read` 的全部书籍，不受当前搜索、类型／标签筛选、排序或批量选择影响；不写库，不改备份格式。
- 多本时重抽排除上一书籍 ID；单本时允许重复。同名但 ID 不同是两本书。
- 无封面使用现有 `BookCover`；可选作者、标签、想看理由为空时不显示空字段。沿用 `useTheme()`。
- 读取失败给“重试”，零候选给“添加小说”；导航到真实详情。
- Windows 使用 `npm.cmd`／`npx.cmd`；只运行针对性测试和必要的类型／lint 检查；iPhone 未实测则标记待验收。

## Review Focus

- 搜索词或标签筛选当前只展示少数书时，抽取仍覆盖整个“想读”集合；任务 2 页面测试。
- 前一本被删除或改成“在读”后重抽，不展示过期内容；任务 2 页面测试。
- 同名书有不同 ID，多本重抽按 ID 避开上一本；任务 1 测试。
- 只有一本时反复重抽不进入死循环；任务 1 测试。
- 仓储读取报错时不显示“没有想读书”，可重试；任务 2 页面测试。

---

## 文件分工

- 新建 `src/books/randomWantToRead.ts` 与 `tests/books/randomWantToRead.test.ts`：候选过滤、选择与边界。
- 新建 `src/books/RandomWantToReadSheet.tsx` 与 `tests/books/RandomWantToReadSheet.test.tsx`：结果、空状态、加载和错误展示。
- 修改 `src/books/BookshelfScreen.tsx`、`src/books/BookshelfToolbar.tsx`、`tests/books/BookshelfToolbar.test.tsx`、`tests/books/bookRoutes.test.tsx`：书架入口、最新数据读取、详情导航。
- 更新 `README.md`：操作说明和真机检查。

### 任务 1：独立的随机选择规则

**文件：** 新建 `src/books/randomWantToRead.ts`、`tests/books/randomWantToRead.test.ts`。

**Interfaces:** `selectWantToReadBook(books: readonly Book[], previousId: string | null, random: () => number): Book | null`。`random()` 约定返回 `[0,1)`；超界或非有限值报错，便于定位错误随机源。返回 `null` 表示候选为空。

- [ ] **步骤 1：写失败测试。** `selects_only_want_to_read_uniformly` 用受控随机数 0、0.49、0.99 覆盖三本想读书的各个区间，夹入在读书不影响机会；`avoids_previous_id_and_allows_single_candidate` 断言两本以上不重复、单本可重复；`distinguishes_same_title_by_id` 断言同名不同 ID；`rejects_invalid_random_value` 断言 `NaN`、1 和负数报错。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/randomWantToRead.test.ts`；预期新函数缺失。
- [ ] **步骤 3：实现选择器。** 先按 `status === 'want_to_read'` 过滤；候选多于一项时排除仍存在的 `previousId`；使用 `Math.floor(random() * count)` 等概率取索引，不修改输入数组。
- [ ] **步骤 4：运行绿灯。** 重跑步骤 2；全部通过。

### 任务 2：书架入口与抽取弹层

**文件：** 新建 `src/books/RandomWantToReadSheet.tsx`、`tests/books/RandomWantToReadSheet.test.tsx`；修改 `src/books/BookshelfScreen.tsx`、`src/books/BookshelfToolbar.tsx`、`tests/books/BookshelfToolbar.test.tsx`、`tests/books/bookRoutes.test.tsx`、`README.md`。

**Interfaces:** `RandomWantToReadSheet({ book, candidateCount, loading, error, onReroll, onRetry, onOpenBook, onAddBook, onClose }: { book: Book | null; candidateCount: number; loading: boolean; error: string | null; onReroll(): void; onRetry(): void; onOpenBook(id: string): void; onAddBook(): void; onClose(): void })`。`BookshelfScreen` 内 `roll(previousId: string | null): Promise<void>` 每次调用 `useBooks().list()` 再调用任务 1 选择器，并传入本次想读候选数；加请求序号，关闭弹层后的旧请求不得重新打开它。`BookshelfToolbar` 增加 `onRandomWantToRead(): void`。

- [ ] **步骤 1：写失败组件测试。** `shows_book_details_and_optional_fields` 断言封面、书名、作者、标签和想看理由；缺省资料不显示空字段；`shows_empty_error_and_single_book_states` 断言空书架可去添加、读取错误可重试、单本重抽有提示；`opens_random_from_whole_wishlist` 在搜索／筛选结果只含其他书时仍可抽到未显示的想读书；`refreshes_candidates_on_reroll` 修改假仓储列表后重抽，旧书不出现；`opens_selected_id_without_mutation` 检查详情路由与仓储无写调用。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/RandomWantToReadSheet.test.tsx tests/books/BookshelfToolbar.test.tsx tests/books/bookRoutes.test.tsx`；预期组件或入口断言失败。
- [ ] **步骤 3：实现弹层与接线。** 复用现有 `BookCover`、主题色和详情路由；书架工具栏放“从想读中抽一本”。每次打开／重抽从 `BookRepository.list()` 取最新数据；错误、零候选、结果三种界面互斥。关闭或进入详情取消本次请求的显示权；不影响书架已设置的筛选及批量选择。
- [ ] **步骤 4：运行绿灯。** 重跑步骤 2，再运行 `npx.cmd tsc --noEmit`、`npm.cmd run lint`、`git diff --check`；全部通过。README 写明抽取范围与单本规则。

### 任务 3：集中验收

**文件：** 只有针对本功能发现的问题才改对应文件。

- [ ] **步骤 1：运行定向回归。** `npm.cmd test -- --runInBand tests/books/randomWantToRead.test.ts tests/books/RandomWantToReadSheet.test.tsx tests/books/BookshelfToolbar.test.tsx tests/books/bookRoutes.test.tsx`；确认通过。
- [ ] **步骤 2：交付 iPhone 检查。** 依次试空想读、一部、两部、已应用其他筛选、从抽取进入详情、改状态后重抽；记录真实结果。未收到实机结果时明确“待验收”。
