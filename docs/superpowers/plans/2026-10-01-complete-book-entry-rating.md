# 新建小说完整资料与半星评分实施计划

> **供执行者阅读：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项实施本计划。任务进度使用复选框（`- [ ]`）记录。

**目标：** 新建小说时可一次填写书名、作者、状态、任意多个主角及可选半星评分，同时保持旧书数据完整。

**架构：** 在现有 `books` 表增加可空的半星整数列，沿用有序主角关联表。仓储负责校验和事务；新建、编辑共用一个无新依赖的评分控件，详情页负责展示。已有导航和刷新机制保持不变。

**技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、`expo-sqlite`、Jest、React Native Testing Library、Node `node:sqlite`；不新增依赖。

**设计文档：** `docs/superpowers/specs/2026-10-01-complete-book-entry-rating-design.md`

## 全局约束

- 状态为 `want_to_read`／`reading`／`finished`／`dropped`；“已读”对应现有界面文案“读完”。新书默认 `want_to_read`，只填书名仍可保存。
- 评分是整本书的可空总体评分，`ratingHalfStars` 只能为 `null` 或整数 `1`～`10`，展示为 0.5～5 星；旧书不自动评分。
- 作者和主角可空；默认两个主角输入框，可增加任意个；保存时去首尾空白、丢弃空名字并保留顺序。
- 新建非“读完”书不能评分；已评分旧书切到其他状态时保留原分，可清除，只有“读完”才能新设或改分。
- 新建和编辑中的书籍字段、主角必须原子保存；错误时不丢输入，不误报成功，不重复提交。
- 不做首刷／二刷记录、搜索、删除、封面、标签、云同步；不为旧书补造阅读记录。
- Windows PowerShell 使用 `npm.cmd`／`npx.cmd`；完成时跑测试、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`，iPhone Expo Go 真机验收需用户配合。修改 Expo API 前核对 SDK 57 官方文档。
- 不自动推送 GitHub；执行前按 `superpowers:using-git-worktrees` 建立隔离工作区，保护现有 `main` 和用户改动。

## 重点复核

1. 旧数据库可能是第一版、第二版或已升级版：任务 1 测试三种状态重复迁移后数据和版本都正确。
2. 运行时传入 `1.5`、`0`、`11` 或非整数评分：任务 2 测试全部拒绝，数据库不写入。
3. 新建时从“读完”切到“在读”再切回：任务 4 测试最终提交的状态、评分和已填作者／主角。
4. 已评分小说切到非“读完”时误把分数清空或改成新值：任务 2 和任务 3 测试保留、清除与拒绝改分。
5. 主角插入中途失败或用户连点保存：任务 2 测试事务回滚，任务 3／4 测试按钮禁用和输入保留。

---

## 文件分工

- `src/storage/database.ts`：第三版评分列迁移；`tests/books/migration.test.ts`：旧库兼容。
- `src/books/types.ts`、`src/books/validation.ts`：公开输入类型与标准化；`src/books/sqliteRepository.ts`：原子创建／更新及评分读写；仓储测试验证行为。
- `src/books/RatingField.tsx`：半星选择、数字显示与清除；新建和编辑表单共用。
- `src/books/BookEditForm.tsx`、`src/books/BookDetail.tsx`：评分编辑／展示；`src/books/AddBookForm.tsx`：完整新建表单。
- `tests/books/`：迁移、仓储、表单、详情和路由回归；`README.md`：更新使用与真机验收步骤。

### Task 1: 无损增加评分列

**文件：** 修改 `src/storage/database.ts`、`tests/books/migration.test.ts`。

**接口：** `migrateDatabase(db: Database): Promise<void>` 保持不变。`books.rating_half_stars INTEGER NULL` 加约束：空值或整数 `1`～`10`；成功后 `PRAGMA user_version = 3`。

- [ ] **步骤 1：编写会失败的迁移测试。** 在 `migration.test.ts` 测 v1、带作者／主角的 v2、全新库和重复迁移；关键断言：旧 ID、标题、作者、状态、主角、时间戳不变，`rating_half_stars: null`，`user_version: 3`，`COUNT(*)` 不变。
- [ ] **步骤 2：运行针对性测试，确认失败。** 运行 `npm.cmd test -- --runInBand tests/books/migration.test.ts`；预期新增评分列／版本断言失败。
- [ ] **步骤 3：实现迁移。** 新建表直接含评分列；现有表先用 `PRAGMA table_info(books)` 检查，缺列才 `ALTER TABLE`；保留原有作者／主角迁移，所有步骤成功后设版本 3。
- [ ] **步骤 4：重新运行测试。** 运行 `npm.cmd test -- --runInBand tests/books/migration.test.ts`；预期通过。
- [ ] **步骤 5：提交。** 只暂存本任务两个文件，提交信息为 `feat: migrate half-star rating column`。

### Task 2: 校验并原子保存完整小说资料

**文件：** 修改 `src/books/types.ts`、`src/books/validation.ts`、`src/books/sqliteRepository.ts`、`tests/books/sqliteRepository.test.ts`、`tests/books/editBook.test.ts`；同步调整 `tests/books/BookEditForm.test.tsx`、`tests/books/BookDetail.test.tsx`、`tests/books/bookRoutes.test.tsx` 的 `Book` 测试数据。

**接口：** `Book.ratingHalfStars: number | null`；`BookInput = Pick<Book, 'title' | 'status'> & Partial<Pick<Book, 'author' | 'protagonists' | 'ratingHalfStars'>>`；`BookEditInput = Pick<Book, 'title' | 'author' | 'status' | 'protagonists'> & Partial<Pick<Book, 'ratingHalfStars'>>`。`normalizeBookCreate(input: BookInput): Pick<Book, 'title' | 'author' | 'status' | 'protagonists' | 'ratingHalfStars'>`；`normalizeBookEdit(input: BookEditInput): BookEditInput`；仓储 `create`／`update` 签名不变。编辑省略评分表示保留已有值；传 `null` 表示清除。

- [ ] **步骤 1：编写会失败的仓储测试。** 断言快速新增返回 `author: null, protagonists: [], ratingHalfStars: null`；完整新增经 `get`／`list` 读回去空白后的作者、有序主角和 `ratingHalfStars: 9`；非读完新增带评分、`0`／`1.5`／`11`、空标题、无效状态均拒绝且不写库。注入 `book_protagonists` 的 `BEFORE INSERT` 错误，断言新建后 `books` 无半成品。编辑测试覆盖评分保留、明确清除、读完改分、非读完非法改分，以及主角插入失败时评分和原字段一起回滚。
- [ ] **步骤 2：运行针对性测试，确认失败。** 运行 `npm.cmd test -- --runInBand tests/books/sqliteRepository.test.ts tests/books/editBook.test.ts`；预期新增断言失败。
- [ ] **步骤 3：实现类型、校验和仓储。** `create` 标准化默认值，在 `withExclusiveTransactionAsync` 内写书与主角；`update` 在事务中读取旧分，省略时保留、`null` 时清除；非 `finished` 状态只能保留原分或清除，不能新设或修改。`get`／`list` 将数据库列映射到 `ratingHalfStars`；所有 SQL 使用参数绑定。
- [ ] **步骤 4：更新测试数据并验证。** 运行 `npm.cmd test -- --runInBand tests/books/migration.test.ts tests/books/sqliteRepository.test.ts tests/books/editBook.test.ts` 和 `npx.cmd tsc --noEmit`；全部通过。
- [ ] **步骤 5：提交。** 只暂存本任务文件，提交信息为 `feat: persist complete novels and ratings`。

### Task 3: 可访问的评分控件、编辑和详情

**文件：** 新建 `src/books/RatingField.tsx`、`tests/books/RatingField.test.tsx`；修改 `src/books/BookEditForm.tsx`、`src/books/BookDetail.tsx`、`tests/books/BookEditForm.test.tsx`、`tests/books/BookDetail.test.tsx`、`tests/books/bookRoutes.test.tsx`。

**接口：** `RatingField({ value, onChange, allowNewValue }: { value: number | null; onChange: (value: number | null) => void; allowNewValue: boolean })`：可选十个有无障碍标签的半星值（`0.5 星`～`5 星`），数字显示如 `4.5 / 5 星`；已有评分可点“清除评分”。`BookEditForm` 仍调用 `onSave(BookEditInput)`，但明确传 `ratingHalfStars`。

- [ ] **步骤 1：编写会失败的组件测试。** 点击无障碍标签 `4.5 星` 得到 `9`，点击“清除评分”得到 `null`；`allowNewValue=false` 时隐藏设置选项但显示已有值及清除。编辑已评分书切到“在读”后保存仍传原分；明确清除传 `null`；切回“读完”可改分；保存失败保留表单，保存期间不可连点。详情断言有分显示 `4.5 / 5 星`、无分显示“未评分”。路由测试断言编辑页将评分交给 `repo.update`。
- [ ] **步骤 2：运行针对性测试，确认失败。** 运行 `npm.cmd test -- --runInBand tests/books/RatingField.test.tsx tests/books/BookEditForm.test.tsx tests/books/BookDetail.test.tsx tests/books/bookRoutes.test.tsx`；预期新增断言失败。
- [ ] **步骤 3：实现组件。** 控件用 React Native 可点击元素和文字，不引入原生依赖；编辑时仅 `finished` 可设新分，非读完保留原分并可清除；从“读完”切走时未提交的新评分不得覆盖原分。详情页显示总体评分。
- [ ] **步骤 4：重新运行测试。** 运行上述针对性测试和 `npx.cmd tsc --noEmit`；全部通过。
- [ ] **步骤 5：提交。** 只暂存本任务文件，提交信息为 `feat: edit and show half-star ratings`。

### Task 4: 新建时一次填写全部资料

**文件：** 修改 `src/books/AddBookForm.tsx`、`tests/books/addBook.test.tsx`、`README.md`；仅在现有 `repo.create(input)` 连接需要改变时调整 `src/app/book/new.tsx`。

**接口：** `AddBookForm({ onSave }: { onSave: (input: BookInput) => Promise<void> })` 保持；提交时给出标准化的 `title, author, status, protagonists, ratingHalfStars`，非 `finished` 传 `null`。复用任务 3 的 `RatingField`。

- [ ] **步骤 1：编写会失败的表单测试。** 只填书名时 `onSave` 收到默认想读、空作者／主角／评分；新建“读完”输入 `[' 阿青 ', '', ' 李四 ']` 并选 `4.5 星`，断言传有序名字及 `ratingHalfStars: 9`；选择四种状态、增加第三个主角；从读完切到在读提交评分为 `null`，再切回读完能重新选择；空书名阻止提交；失败后输入保留且可重试，保存期间不可双击。
- [ ] **步骤 2：运行针对性测试，确认失败。** 运行 `npm.cmd test -- --runInBand tests/books/addBook.test.tsx`；预期新增断言失败。
- [ ] **步骤 3：实现完整新建表单。** 保持首屏“只填书名”的简便路径；新建默认两个主角框，状态四选一；仅状态为读完时显示评分；按钮改为“保存小说”；保存时复用 `normalizeBookCreate`，出错保留输入。
- [ ] **步骤 4：运行完整自动检查。** 运行 `npm.cmd test -- --runInBand`、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`npx.cmd expo-doctor`；记录各项实际结果。检查 `git diff --check` 与 `git status --short`。
- [ ] **步骤 5：更新说明并提交。** 在 `README.md` 说明新建、半星与旧书兼容；只暂存任务 4 文件，提交信息为 `feat: enter complete novel on creation`。
- [ ] **步骤 6：请用户用 iPhone 验收。** 请用户在 Expo Go 实机新增一册“读完”且 4.5 星的小说、关闭再打开，并确认作者、主角、状态、评分仍在；再检查一册旧书仍未评分。没有用户反馈时标记“待实机验证”，不能声称通过。

## 执行交接

每项依照红灯测试、最小实现、绿灯测试、本地提交的顺序执行。最后只报告本地提交与自动验证结果；未经用户明确要求，不推送或合并 GitHub。首刷／二刷记录留给单独的后续计划。
