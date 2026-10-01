# 新建小说完整资料与半星评分 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建小说时可一次填写书名、作者、状态、任意多个主角及可选半星评分，同时保持旧书数据完整。

**Architecture:** 在现有 `books` 表增加可空的半星整数列，沿用有序主角关联表。仓储负责校验和事务；新建、编辑共用一个无新依赖的评分控件，详情页负责展示。已有导航和刷新机制保持不变。

**Tech Stack:** Expo SDK 57、Expo Router、React Native、TypeScript、`expo-sqlite`、Jest、React Native Testing Library、Node `node:sqlite`；不新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-01-complete-book-entry-rating-design.md`

## Global Constraints

- 状态为 `want_to_read`／`reading`／`finished`／`dropped`；“已读”对应现有界面文案“读完”。新书默认 `want_to_read`，只填书名仍可保存。
- 评分是整本书的可空总体评分，`ratingHalfStars` 只能为 `null` 或整数 `1`～`10`，展示为 0.5～5 星；旧书不自动评分。
- 作者和主角可空；默认两个主角输入框，可增加任意个；保存时去首尾空白、丢弃空名字并保留顺序。
- 新建非“读完”书不能评分；已评分旧书切到其他状态时保留原分，可清除，只有“读完”才能新设或改分。
- 新建和编辑中的书籍字段、主角必须原子保存；错误时不丢输入，不误报成功，不重复提交。
- 不做首刷／二刷记录、搜索、删除、封面、标签、云同步；不为旧书补造阅读记录。
- Windows PowerShell 使用 `npm.cmd`／`npx.cmd`；完成时跑测试、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`，iPhone Expo Go 真机验收需用户配合。修改 Expo API 前核对 SDK 57 官方文档。
- 不自动推送 GitHub；执行前按 `superpowers:using-git-worktrees` 建立隔离工作区，保护现有 `main` 和用户改动。

## Review Focus

1. 旧数据库可能是第一版、第二版或已升级版：任务 1 测试三种状态重复迁移后数据和版本都正确。
2. 运行时传入 `1.5`、`0`、`11` 或非整数评分：任务 2 测试全部拒绝，数据库不写入。
3. 新建时从“读完”切到“在读”再切回：任务 4 测试最终提交的状态、评分和已填作者／主角。
4. 已评分小说切到非“读完”时误把分数清空或改成新值：任务 2 和任务 3 测试保留、清除与拒绝改分。
5. 主角插入中途失败或用户连点保存：任务 2 测试事务回滚，任务 3／4 测试按钮禁用和输入保留。

---

## File Structure

- `src/storage/database.ts`：第三版评分列迁移；`tests/books/migration.test.ts`：旧库兼容。
- `src/books/types.ts`、`src/books/validation.ts`：公开输入类型与标准化；`src/books/sqliteRepository.ts`：原子创建／更新及评分读写；仓储测试验证行为。
- `src/books/RatingField.tsx`：半星选择、数字显示与清除；新建和编辑表单共用。
- `src/books/BookEditForm.tsx`、`src/books/BookDetail.tsx`：评分编辑／展示；`src/books/AddBookForm.tsx`：完整新建表单。
- `tests/books/`：迁移、仓储、表单、详情和路由回归；`README.md`：更新使用与真机验收步骤。

### Task 1: 无损增加评分列

**Files:** Modify `src/storage/database.ts`, `tests/books/migration.test.ts`.

**Interfaces:** `migrateDatabase(db: Database): Promise<void>` 保持不变。`books.rating_half_stars INTEGER NULL` 加约束：空值或整数 `1`～`10`；成功后 `PRAGMA user_version = 3`。

- [ ] **Step 1: Write failing migration tests.** 在 `migration.test.ts` 测 v1、带作者／主角的 v2、全新库和重复迁移；关键断言：旧 ID、标题、作者、状态、主角、时间戳不变，`rating_half_stars: null`，`user_version: 3`，`COUNT(*)` 不变。
- [ ] **Step 2: Confirm red.** Run `npm.cmd test -- --runInBand tests/books/migration.test.ts`; expected: new rating-column/version assertions FAIL.
- [ ] **Step 3: Implement migration.** 新建表直接含评分列；现有表先用 `PRAGMA table_info(books)` 检查，缺列才 `ALTER TABLE`；保留原有作者／主角迁移，所有步骤成功后设版本 3。
- [ ] **Step 4: Confirm green.** Run `npm.cmd test -- --runInBand tests/books/migration.test.ts`; expected: PASS.
- [ ] **Step 5: Commit.** Stage only the two task files; `git commit -m "feat: migrate half-star rating column"`.

### Task 2: 校验并原子保存完整小说资料

**Files:** Modify `src/books/types.ts`, `src/books/validation.ts`, `src/books/sqliteRepository.ts`, `tests/books/sqliteRepository.test.ts`, `tests/books/editBook.test.ts`; update `Book` fixtures in `tests/books/BookEditForm.test.tsx`, `tests/books/BookDetail.test.tsx`, `tests/books/bookRoutes.test.tsx`.

**Interfaces:** `Book.ratingHalfStars: number | null`；`BookInput = Pick<Book, 'title' | 'status'> & Partial<Pick<Book, 'author' | 'protagonists' | 'ratingHalfStars'>>`；`BookEditInput = Pick<Book, 'title' | 'author' | 'status' | 'protagonists'> & Partial<Pick<Book, 'ratingHalfStars'>>`。`normalizeBookCreate(input: BookInput): Pick<Book, 'title' | 'author' | 'status' | 'protagonists' | 'ratingHalfStars'>`；`normalizeBookEdit(input: BookEditInput): BookEditInput`；仓储 `create`／`update` 签名不变。编辑省略评分表示保留已有值；传 `null` 表示清除。

- [ ] **Step 1: Write failing repository tests.** 断言快速新增返回 `author: null, protagonists: [], ratingHalfStars: null`；完整新增经 `get`／`list` 读回去空白后的作者、有序主角和 `ratingHalfStars: 9`；非读完新增带评分、`0`／`1.5`／`11`、空标题、无效状态均拒绝且不写库。注入 `book_protagonists` 的 `BEFORE INSERT` 错误，断言新建后 `books` 无半成品。编辑测试覆盖评分保留、明确清除、读完改分、非读完非法改分，以及主角插入失败时评分和原字段一起回滚。
- [ ] **Step 2: Confirm red.** Run `npm.cmd test -- --runInBand tests/books/sqliteRepository.test.ts tests/books/editBook.test.ts`; expected: new assertions FAIL.
- [ ] **Step 3: Implement types, validation and repository.** `create` 标准化默认值，在 `withExclusiveTransactionAsync` 内写书与主角；`update` 在事务中读取旧分，省略时保留、`null` 时清除；非 `finished` 状态只能保留原分或清除，不能新设或修改。`get`／`list` 将数据库列映射到 `ratingHalfStars`；所有 SQL 使用参数绑定。
- [ ] **Step 4: Update typed test fixtures and verify.** Run `npm.cmd test -- --runInBand tests/books/migration.test.ts tests/books/sqliteRepository.test.ts tests/books/editBook.test.ts` and `npx.cmd tsc --noEmit`; expected: PASS/exit 0.
- [ ] **Step 5: Commit.** Stage only the task files; `git commit -m "feat: persist complete novels and ratings"`.

### Task 3: 可访问的评分控件、编辑和详情

**Files:** Create `src/books/RatingField.tsx`, `tests/books/RatingField.test.tsx`; modify `src/books/BookEditForm.tsx`, `src/books/BookDetail.tsx`, `tests/books/BookEditForm.test.tsx`, `tests/books/BookDetail.test.tsx`, `tests/books/bookRoutes.test.tsx`.

**Interfaces:** `RatingField({ value, onChange, allowNewValue }: { value: number | null; onChange: (value: number | null) => void; allowNewValue: boolean })`：可选十个有无障碍标签的半星值（`0.5 星`～`5 星`），数字显示如 `4.5 / 5 星`；已有评分可点“清除评分”。`BookEditForm` 仍调用 `onSave(BookEditInput)`，但明确传 `ratingHalfStars`。

- [ ] **Step 1: Write failing component tests.** 点击无障碍标签 `4.5 星` 得到 `9`，点击“清除评分”得到 `null`；`allowNewValue=false` 时隐藏设置选项但显示已有值及清除。编辑已评分书切到“在读”后保存仍传原分；明确清除传 `null`；切回“读完”可改分；保存失败保留表单，保存期间不可连点。详情断言有分显示 `4.5 / 5 星`、无分显示“未评分”。路由测试断言编辑页将评分交给 `repo.update`。
- [ ] **Step 2: Confirm red.** Run `npm.cmd test -- --runInBand tests/books/RatingField.test.tsx tests/books/BookEditForm.test.tsx tests/books/BookDetail.test.tsx tests/books/bookRoutes.test.tsx`; expected: new assertions FAIL.
- [ ] **Step 3: Implement UI.** 控件用 React Native 可点击元素和文字，不引入原生依赖；编辑时仅 `finished` 可设新分，非读完保留原分并可清除；从“读完”切走时未提交的新评分不得覆盖原分。详情页显示总体评分。
- [ ] **Step 4: Confirm green.** Re-run targeted tests and `npx.cmd tsc --noEmit`; expected: PASS/exit 0.
- [ ] **Step 5: Commit.** Stage only the task files; `git commit -m "feat: edit and show half-star ratings"`.

### Task 4: 新建时一次填写全部资料

**Files:** Modify `src/books/AddBookForm.tsx`, `tests/books/addBook.test.tsx`, `README.md`; adjust `src/app/book/new.tsx` only if its existing `repo.create(input)` wiring needs change.

**Interfaces:** `AddBookForm({ onSave }: { onSave: (input: BookInput) => Promise<void> })` 保持；提交时给出标准化的 `title, author, status, protagonists, ratingHalfStars`，非 `finished` 传 `null`。复用 Task 3 的 `RatingField`。

- [ ] **Step 1: Write failing form tests.** 只填书名时 `onSave` 收到默认想读、空作者／主角／评分；新建“读完”输入 `[' 阿青 ', '', ' 李四 ']` 并选 `4.5 星`，断言传有序名字及 `ratingHalfStars: 9`；选择四种状态、增加第三个主角；从读完切到在读提交评分为 `null`，再切回读完能重新选择；空书名阻止提交；失败后输入保留且可重试，保存期间不可双击。
- [ ] **Step 2: Confirm red.** Run `npm.cmd test -- --runInBand tests/books/addBook.test.tsx`; expected: new assertions FAIL.
- [ ] **Step 3: Implement complete form.** 保持首屏“只填书名”的简便路径；新建默认两个主角框，状态四选一；仅状态为读完时显示评分；按钮改为“保存小说”；保存时复用 `normalizeBookCreate`，出错保留输入。
- [ ] **Step 4: Run full verification.** Run `npm.cmd test -- --runInBand`, `npx.cmd tsc --noEmit`, `npx.cmd expo lint --no-cache`, `npx.cmd expo-doctor`; record actual result of each. Check `git diff --check` and `git status --short`.
- [ ] **Step 5: Document and commit.** `README.md` 写明新建、半星与旧书兼容；只暂存 Task 4 文件，`git commit -m "feat: enter complete novel on creation"`.
- [ ] **Step 6: iPhone acceptance.** 请用户在 Expo Go 实机新增一册“读完”且 4.5 星的小说、关闭再打开，并确认作者、主角、状态、评分仍在；再检查一册旧书仍未评分。没有用户反馈时标记“待实机验证”，不能声称通过。

## Execution Handoff

每项依照红灯测试、最小实现、绿灯测试、本地提交的顺序执行。最后只报告本地提交与自动验证结果；未经用户明确要求，不推送或合并 GitHub。首刷／二刷记录留给单独的后续计划。
