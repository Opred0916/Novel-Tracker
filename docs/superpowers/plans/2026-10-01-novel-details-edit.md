# 小说详情与编辑实施计划

> **供执行者阅读：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项实施本计划。任务进度使用复选框（`- [ ]`）记录。

**目标：** 用户可以打开已保存的小说，并安全地修改书名、作者、阅读状态及任意数量的主角名字。

**架构：** 在现有 SQLite 仓储中增加可为空的作者字段，以及按顺序保存主角名字的关联表。保留只填书名的快速新增流程；新增详情和编辑组件，再通过 Expo Router 连接页面。一次编辑中的小说字段和主角列表必须在同一个独占事务中更新。

**技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、`expo-sqlite`、Jest、React Native Testing Library；仓储测试使用 Node 的 `node:sqlite`。本次不需要新增依赖包。

**设计文档：** `docs/superpowers/specs/2026-10-01-novel-details-edit-design.md`

## 全局约束

- 数据库升级时保留设备上已有的全部小说记录，包括 ID、书名、状态和创建时间。
- 四种状态仍为 `want_to_read`、`reading`、`finished`、`dropped`。
- 书名必填；作者和主角名字可留空。默认显示两个主角输入框，但只按输入顺序保存非空白名字。
- 快速新增仍然只需填写书名。本计划不增加二刷记录或其他第一版功能。
- 在 Windows 上开发，用 iPhone Expo Go 验收。本机 PowerShell 禁止运行 `npx.ps1`，因此命令使用 `npx.cmd`。
- 沿用现有 `src/app/` 的 Expo Router 页面结构和仓储边界。修改原生 API 前查阅 [Expo SDK 57 的 SQLite 文档](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)；独占事务回调必须使用传入的事务对象，且该接口不支持 Web。
- GitHub Desktop 中的项目目前没有 `node_modules`；测试前在项目根目录运行 `npm.cmd ci`，不要提交 `node_modules`。

## 重点复核

1. 旧数据库已有 `books` 表，但 `user_version = 0`：升级应增加字段而不替换旧记录；任务 1 测试升级及重复执行升级。
2. 书名为空或只有空格：拒绝保存，旧数据不变，表单保留用户输入；任务 2 和任务 3 测试。
3. 主角输入为零个、一个、两个、三个以上，或包含空白和标点：只保存去除首尾空白后的非空名字，并保留顺序；任务 2 和任务 3 测试。
4. 小说字段写入后、主角列表替换完成前发生错误：整个编辑应回滚；任务 2 注入失败并检查两张表。
5. 详情或编辑页面收到不存在的 ID，或数据库读取失败：显示错误和返回路径，不崩溃，也不误报成功；任务 4 测试。

---

## 文件分工

- `src/storage/database.ts`：可重复执行的数据库升级、作者字段、有序主角表、外键及支持事务的数据库类型。
- `tests/helpers/inMemoryDatabase.ts`：为仓储测试提供真正支持回滚的 `node:sqlite` 适配器。
- `src/books/types.ts`、`src/books/validation.ts`、`src/books/status.ts`：扩展 `Book` 和 `BookEditInput`，处理输入校验及共用的中文状态名称。
- `src/books/repository.ts`、`src/books/sqliteRepository.ts`：原子更新小说，以及读取作者和主角列表。
- `src/books/BookEditForm.tsx`、`src/books/BookDetail.tsx`、`src/books/BookCard.tsx`：编辑表单、详情展示和可点击的书架卡片。
- `src/app/index.tsx`、`src/app/book/[id].tsx`、`src/app/book/[id]/edit.tsx`、`src/app/_layout.tsx`：连接页面，并在页面重新获得焦点时读取最新数据。
- `tests/books/`：数据库升级、仓储、表单及页面/卡片测试。`README.md`：新增使用流程和真机验收说明。

### 任务 1：升级 SQLite，并保留已有小说

**文件：** 修改 `src/storage/database.ts`；新建 `tests/helpers/inMemoryDatabase.ts`、`tests/books/migration.test.ts`；调整 `tests/books/sqliteRepository.test.ts`，改用共用的测试适配器。

**接口：** 保留公开的 `migrateDatabase(db: Database): Promise<void>`；`Database` 增加 `withExclusiveTransactionAsync`。`createInMemoryDatabase(): Database & { close(): void }` 提供基于真实 SQLite 的测试适配器。数据库增加 `books.author TEXT NULL` 和 `book_protagonists(book_id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL, PRIMARY KEY(book_id, position), FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE)`。

- [ ] **步骤 1：安装锁定版本的依赖。** 在本项目运行 `npm.cmd ci`；预期退出码为 0，并保持 `node_modules` 被 Git 忽略。
- [ ] **步骤 2：编写会失败的升级测试。** 建立第一版 `books` 表和一条 `user_version = 0` 的记录；升级后断言 ID、书名、状态和时间戳不变，作者为空，主角表为空，`user_version = 2`，第二次升级也成功。另测全新数据库同时建立两张表。
- [ ] **步骤 3：运行针对性测试，确认测试失败。** 运行 `npm.cmd test -- --runInBand tests/books/migration.test.ts`；预期因缺少第二版结构或版本号而失败。
- [ ] **步骤 4：实现升级和测试适配器。** 执行 `ALTER TABLE` 前检查 `books` 表及作者字段是否已存在；按需建立主角表，启用外键，仅在升级成功后设置版本号。测试适配器使用真正的 `BEGIN`／`COMMIT`／`ROLLBACK`，并把事务适配器传给回调。
- [ ] **步骤 5：重新运行升级测试和原有仓储测试。** 运行 `npm.cmd test -- --runInBand tests/books/migration.test.ts tests/books/sqliteRepository.test.ts`，两组都应通过；再运行 `npx.cmd tsc --noEmit`。
- [ ] **步骤 6：提交。** 只暂存任务 1 的文件，提交信息为 `feat: migrate novel details schema`。

### 任务 2：校验并原子保存编辑内容

**文件：** 修改 `src/books/types.ts`、`src/books/repository.ts`、`src/books/sqliteRepository.ts`；新建 `src/books/validation.ts`、`tests/books/editBook.test.ts`。

**接口：** `Book` 增加 `author: string | null` 和 `protagonists: string[]`；快速新增使用的 `BookInput` 仍只包含书名和状态。`BookEditInput = Pick<Book, 'title' | 'author' | 'status' | 'protagonists'>`。`normalizeBookEdit(input: BookEditInput): BookEditInput` 去除书名、作者和主角名字首尾空白，把空白作者转为 `null`，丢弃空白主角；书名为空或状态无效时抛错。`BookRepository.update(id: string, input: BookEditInput): Promise<Book>` 在 ID 不存在时抛错，保留 ID 和 `createdAt`，更新 `updatedAt`。

- [ ] **步骤 1：编写会失败的测试。** 断言 `create` 返回 `author: null` 和 `protagonists: []`；`update` 后重新 `get`／`list`，能读回修改的书名、作者、状态，并把 `[' 阿青 ', '', '李,四', ' 王五 ']` 保存为 `['阿青', '李,四', '王五']`。空书名和运行时传入的无效状态应被拒绝且不改旧记录；不存在的 ID 应报错。再用 SQLite 的 `BEFORE INSERT` 触发器使主角写入失败，断言小说字段和原有主角都不变。
- [ ] **步骤 2：运行测试，确认失败。** 运行 `npm.cmd test -- --runInBand tests/books/editBook.test.ts`；预期因缺少更新接口、字段或校验而失败。
- [ ] **步骤 3：实现领域类型和仓储。** 所有 SQL 数据均使用参数绑定。`get` 和 `list` 按 `position` 读取主角。更新时使用 `withExclusiveTransactionAsync(async txn => ...)`，所有小说与主角写入都通过 `txn` 执行，提交成功后再读取完整小说。不要改变只填书名的快速新增表单。
- [ ] **步骤 4：验证。** 重新运行 `tests/books/editBook.test.ts`、`tests/books/sqliteRepository.test.ts` 及 `npx.cmd tsc --noEmit`；全部通过。
- [ ] **步骤 5：提交。** 只暂存任务 2 的文件，提交信息为 `feat: persist editable novel details`。

### 任务 3：制作详情展示与编辑表单

**文件：** 新建 `src/books/status.ts`、`src/books/BookEditForm.tsx`、`src/books/BookDetail.tsx`、`tests/books/BookEditForm.test.tsx`、`tests/books/BookDetail.test.tsx`。

**接口：** `BookEditForm({ book, onSave }: { book: Book; onSave: (input: BookEditInput) => Promise<void> })`；`BookDetail({ book }: { book: Book })`；`BOOK_STATUS_LABELS: Record<BookStatus, string>` 将四种状态映射为“想读／在读／读完／弃读”。编辑表单预填已有内容，显示 `Math.max(2, book.protagonists.length)` 个主角输入框，点击“＋ 添加主角”再增加一格，并由用户手动保存。错误由表单展示；只有 `onSave` 成功后，页面才返回。

- [ ] **步骤 1：编写会失败的组件测试。** 没有主角的小说应显示两个空输入框；已有三个主角时应全部显示；增加第三格并保存时，按顺序传出名字。空书名应显示错误且不调用 `onSave`；`onSave` 失败后保留输入并允许重试。详情组件按顺序展示作者、状态和主角；可选信息为空时给出提示。
- [ ] **步骤 2：运行测试，确认失败。** 运行 `npm.cmd test -- --runInBand tests/books/BookEditForm.test.tsx tests/books/BookDetail.test.tsx`；预期因组件尚不存在而失败。
- [ ] **步骤 3：实现组件。** 延续现有 React Native 样式；为每个主角输入框提供清楚的标签和无障碍说明；保存期间避免重复点击；显示四种状态选项。保存数据时复用 `normalizeBookEdit`。
- [ ] **步骤 4：验证。** 重新运行针对性测试及 `npx.cmd tsc --noEmit`；全部通过。
- [ ] **步骤 5：提交。** 只暂存任务 3 的文件，提交信息为 `feat: add novel detail and edit components`。

### 任务 4：连接书架、详情页和编辑页

**文件：** 新建 `src/books/BookCard.tsx`、`src/app/book/[id].tsx`、`src/app/book/[id]/edit.tsx`、`tests/books/bookRoutes.test.tsx`；修改 `src/app/index.tsx`、`src/app/_layout.tsx`、`README.md`。

**接口：** `BookCard({ book, onPress }: { book: Book; onPress: () => void })` 显示真实阅读状态。详情页和编辑页通过 `useLocalSearchParams` 获取 `id`，在页面获得焦点时调用 `useBooks().get(id)`，处理加载中、读取失败及找不到小说的情况，并提供页面间入口。编辑页调用 `repo.update(id, input)`，仅在成功后返回；书架继续沿用现有的焦点刷新方式。

- [ ] **步骤 1：编写会失败的页面和卡片测试。** 点击书架卡片应进入对应页面并显示真实状态。模拟 `useBooks` 和路由参数，断言详情能读取并展示数据，编辑页能预填并调用 `update`；未知 ID 有返回入口，读取失败有错误提示和重试路径。
- [ ] **步骤 2：运行测试，确认失败。** 运行 `npm.cmd test -- --runInBand tests/books/bookRoutes.test.tsx`；预期因页面或卡片行为尚不存在而失败。
- [ ] **步骤 3：连接页面和书架。** 在 `Stack` 中注册两个页面，使用带参数的本地导航，保持新增流程不变，并在 `README.md` 补充编辑流程和真机测试步骤。
- [ ] **步骤 4：运行完整自动检查。** 运行 `npm.cmd test -- --runInBand`、`npx.cmd tsc --noEmit`、`npx.cmd expo lint`，均应以退出码 0 结束。运行 `npx.cmd expo-doctor` 并记录诊断；只有它确实通过时才能称为通过。
- [ ] **步骤 5：请用户用 iPhone 验收。** 从这个 GitHub 项目目录以 LAN 模式启动 Expo；请用户打开第一版已有小说，填入三个主角、修改状态，关闭并重新进入项目，报告新旧记录是否都保留。收到用户反馈后，才能标记真机验收完成。
- [ ] **步骤 6：提交。** 完成自动检查和范围内修复后，只暂存任务 4 的文件，提交信息为 `feat: navigate and edit novels`。

## 执行交接

任务按顺序执行，每项完成后都要经过测试和本地提交。不要自动推送到 GitHub，也不要提前开始二刷记录功能；完成后报告本地提交，由用户决定何时推送。如果当时无法进行 iPhone 真机验证，应标记为“待验证”，不能声称已通过。
