# 作品类型与标签系统实施计划

> **供执行者阅读：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项实施本计划。任务进度使用复选框（`- [ ]`）记录。

**目标：** 为小说增加单选作品类型、多选标签和可配置快捷标签，并支持书架搜索与筛选，同时保持现有小说和评分数据不丢失。

**架构：** 在现有 SQLite 本地仓储中增加作品类型、标签库、书籍标签关联和快捷标签配置表；标签库与书籍关联使用稳定 ID 和外键。表单只负责编辑输入，校验与事务保存由类型校验层和仓储负责；书架筛选在仓储返回的数据上进行，避免页面直接依赖 SQL 细节。

**技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、`expo-sqlite`、Jest、React Native Testing Library、Node `node:sqlite`；不新增依赖。

**设计文档：** `docs/superpowers/specs/2026-09-29-novel-tracker-design.md`

## 全局约束

- 作品类型只能单选，初始值为 `romance_male_male`（耽美）、`romance_female_male`（言情）、`romance_female_female`（GL）、`no_romance`（无CP）、`other`（其他）；允许为空。
- 标签可以多选；系统预设标签和用户自定义标签使用同一标签库，名称去首尾空白后不得为空；同名标签不重复创建。
- 初始系统标签库按常见阅读特点提供：`古代`、`现代`、`都市`、`星际`、`架空`、`西幻`、`玄幻`、`仙侠`、`校园`、`职场`、`娱乐圈`、`豪门`、`悬疑`、`无限流`、`末世`、`穿越`、`重生`、`系统`、`快穿`、`种田`、`哨向`、`兽人`、`群像`、`慢热`、`轻松`、`治愈`、`甜`、`虐`、`酸涩`、`强强`、`年上`、`年下`、`竹马竹马`、`欢喜冤家`、`先婚后爱`、`双向暗恋`、`追妻火葬场`、`替身`、`白月光`、`宿敌`、`万人迷`、`复仇`、`权谋`、`救赎`、`美强惨`、`日常向`、`HE`、`BE`、`OE`、`短篇`、`长篇`、`交通发达`、`荤素搭配`、`清水`、`大女主`、`ABO`、`第一人称`、`第二人称`、`主攻`、`主受`、`破镜重圆`；默认快捷标签仍为 `古代`、`现代`、`悬疑`、`群像`、`慢热`。
- 添加书目时只显示快捷标签；编辑书目时可从完整标签库搜索、选择、取消和新增标签。
- 从快捷标签中移除标签只影响表单展示，不删除标签库，也不删除已有书籍标签。
- 现有书名、作者、主角、状态、评分、创建时间和修改时间必须保持；旧书作品类型为空、标签为空。
- 所有书籍和标签修改必须原子保存；失败时不得留下半成品或丢失原输入。
- Windows PowerShell 使用 `npm.cmd`／`npx.cmd`；完成时运行测试、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache` 和 `npx.cmd expo-doctor`。
- 不实现多次阅读记录、封面、摘记图片、OCR、联网书库、会员和云同步；这些功能属于后续计划。
- 不自动推送 GitHub；执行前按 `superpowers:using-git-worktrees` 建立隔离工作区，保护现有 `main` 和用户改动。

## 重点复核

1. 重复运行迁移不能重复插入预设标签、快捷标签或改变已有书籍关系：任务 1 覆盖。
2. 标签名为空、只含空格或与已有标签大小写相同：任务 2 拒绝空值并按明确规则去重。
3. 移除快捷标签不能删除已使用标签：任务 3 覆盖配置与书籍数据分离。
4. 同一本书选择多个标签、取消一个标签后其余标签仍保留，保存失败时不出现部分关系：任务 2 和任务 3 覆盖。
5. 作品类型筛选与标签筛选叠加时结果正确，清除筛选恢复完整书架：任务 4 覆盖。

---

## 文件分工

- `src/storage/database.ts`：第四版数据库迁移；`tests/books/migration.test.ts`：旧库和重复迁移。
- `src/books/types.ts`、`src/books/validation.ts`：作品类型、标签和快捷标签公开类型及标准化。
- `src/books/tagRepository.ts`、`src/books/sqliteRepository.ts`：标签库、快捷标签、书籍标签关联和原子保存。
- `src/books/TagPicker.tsx`、`src/books/TypePicker.tsx`：标签多选与作品类型单选控件。
- `src/books/AddBookForm.tsx`、`src/books/BookEditForm.tsx`、`src/books/BookDetail.tsx`：新增、编辑、详情展示。
- `src/app/index.tsx`、`src/app/book/new.tsx`、`src/app/book/[id]/edit.tsx`：表单和书架路由连接。
- `tests/books/`：迁移、仓储、标签控件、表单、详情与筛选回归。
- `README.md`：更新作品类型、标签和快捷标签使用说明。

### Task 1: 无损增加作品类型与标签数据结构

**文件：** 修改 `src/storage/database.ts`、`tests/books/migration.test.ts`。

**接口：** `migrateDatabase(db: Database): Promise<void>` 保持不变；成功后 `PRAGMA user_version = 4`。新增 `tags(id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, is_system INTEGER NOT NULL)`、`book_tags(book_id TEXT NOT NULL, tag_id TEXT NOT NULL, PRIMARY KEY(book_id, tag_id), FOREIGN KEY ... ON DELETE CASCADE)`、`quick_tags(tag_id TEXT PRIMARY KEY, position INTEGER NOT NULL, FOREIGN KEY ... ON DELETE CASCADE)`；`books.type TEXT NULL` 只接受允许的作品类型值或 `NULL`。预设标签插入使用幂等语句。

- [ ] **步骤 1：编写会失败的迁移测试。** 覆盖全新库、当前 v3 库、重复迁移；断言旧书 ID／资料／评分不变，`books.type` 全为 `null`，三张新表存在，预设类型标签或配置只出现一次，`user_version` 为 4。
- [ ] **步骤 2：运行针对性测试，确认失败。** 运行 `npm.cmd test -- --runInBand tests/books/migration.test.ts`；预期新表、类型列或版本断言失败。
- [ ] **步骤 3：实现迁移。** 按现有迁移风格检查列和表是否存在，缺失时创建；为 `books.type` 加允许值校验；插入预设标签和默认快捷标签时保证重复执行不重复写入。
- [ ] **步骤 4：重新运行测试。** 运行 `npm.cmd test -- --runInBand tests/books/migration.test.ts`；预期通过。
- [ ] **步骤 5：提交。** 只暂存本任务文件，提交信息为 `feat: migrate book types and tags`。

### Task 2: 类型、标签校验与仓储原子操作

**文件：** 修改 `src/books/types.ts`、`src/books/validation.ts`、`src/books/repository.ts`、`src/books/sqliteRepository.ts`；新建 `src/books/tagRepository.ts`；测试 `tests/books/sqliteRepository.test.ts`、`tests/books/tagRepository.test.ts`。

**接口：** `Book.bookType: BookType | null`、`Book.tags: Tag[]`；`BookInput` 和 `BookEditInput` 增加 `bookType?: BookType | null`、`tagIds?: string[]`；`Tag = { id: string; name: string; isSystem: boolean }`；`normalizeBookCreate`／`normalizeBookEdit` 去首尾空白、去重并保留标签选择顺序。`TagRepository` 提供 `list(): Promise<Tag[]>`、`create(name: string): Promise<Tag>`、`delete(id: string): Promise<void>`、`listQuick(): Promise<Tag[]>`、`setQuick(ids: string[]): Promise<void>`。

- [ ] **步骤 1：编写会失败的仓储测试。** 覆盖新书默认 `bookType: null, tags: []`；保存一个类型和多个标签后经 `get`／`list` 读回；空标签名、重复标签名、非法类型被拒绝；取消一个标签只删除对应 `book_tags` 关系；标签保存中途失败时书籍和关系全部回滚；快捷标签只改变 `quick_tags`，不删除标签或已有书籍关系。
- [ ] **步骤 2：运行针对性测试，确认失败。** 运行 `npm.cmd test -- --runInBand tests/books/sqliteRepository.test.ts tests/books/tagRepository.test.ts`；预期新增字段和接口断言失败。
- [ ] **步骤 3：实现类型、校验和仓储。** 在事务内保存 `books.type`、书籍标签关联和更新时间；标签使用参数绑定 SQL；`list`／`get` 读取稳定顺序的标签；快捷标签按 `position` 返回；删除标签时依赖外键级联清理关系，但不得删除系统预设标签。
- [ ] **步骤 4：重新运行测试并做类型检查。** 运行上述测试和 `npx.cmd tsc --noEmit`；预期全部通过。
- [ ] **步骤 5：提交。** 提交信息为 `feat: persist book types and tags`。

### Task 3: 新增、编辑和详情中的类型标签界面

**文件：** 新建 `src/books/TypePicker.tsx`、`src/books/TagPicker.tsx`；修改 `src/books/AddBookForm.tsx`、`src/books/BookEditForm.tsx`、`src/books/BookDetail.tsx`、相关路由；测试 `tests/books/TypePicker.test.tsx`、`tests/books/TagPicker.test.tsx`、`tests/books/addBook.test.tsx`、`tests/books/BookEditForm.test.tsx`、`tests/books/BookDetail.test.tsx`。

**接口：** `TypePicker({ value, onChange }: { value: BookType | null; onChange: (value: BookType | null) => void })`；`TagPicker({ selectedIds, quickTags, allTags, onChange, onCreateTag }: ...)`。新增表单使用快捷标签，编辑表单可打开完整标签库并新增自定义标签；详情页显示类型和已选标签。

- [ ] **步骤 1：编写会失败的组件与表单测试。** 断言作品类型只能选一个；新增表单显示快捷标签，选中多个标签后提交 `bookType` 和 `tagIds`；编辑表单能搜索完整标签库、取消标签、创建自定义标签；没有类型或标签也能保存；保存失败保留所有输入且保存期间不可重复提交；详情页显示“其他”和自定义标签。
- [ ] **步骤 2：运行针对性测试，确认失败。** 运行 `npm.cmd test -- --runInBand tests/books/TypePicker.test.tsx tests/books/TagPicker.test.tsx tests/books/addBook.test.tsx tests/books/BookEditForm.test.tsx tests/books/BookDetail.test.tsx`；预期新增断言失败。
- [ ] **步骤 3：实现控件和表单连接。** 类型使用五个固定选项（耽美、言情、GL、无CP、其他）；新增页只展示快捷标签；编辑页提供完整标签列表和新增入口；复用现有保存错误处理与键盘避让；不改变已有评分规则。
- [ ] **步骤 4：重新运行测试。** 运行上述测试和 `npx.cmd tsc --noEmit`；预期通过。
- [ ] **步骤 5：提交。** 提交信息为 `feat: edit book types and tags`。

### Task 4: 快捷标签配置与书架筛选

**文件：** 修改 `src/app/index.tsx`、`src/app/_layout.tsx` 或现有设置入口、`src/books/BookCard.tsx`；新建 `src/books/bookFilters.ts`；测试 `tests/books/bookFilters.test.ts`、`tests/books/bookRoutes.test.tsx`、相关组件测试。

**接口：** `filterBooks(books: Book[], filters: { query: string; status: BookStatus | null; bookType: BookType | null; tagIds: string[] }): Book[]`；快捷标签配置调用 `TagRepository.listQuick()`／`setQuick(ids)`。多个筛选条件使用 AND 关系；关键词匹配书名、作者和主角；空筛选返回全部书籍。

- [ ] **步骤 1：编写会失败的筛选测试。** 覆盖关键词匹配书名／作者／主角、状态和作品类型筛选、多个标签同时满足、清除筛选恢复全部、无结果提示；快捷标签移除后已有书籍仍保留标签。
- [ ] **步骤 2：运行针对性测试，确认失败。** 运行 `npm.cmd test -- --runInBand tests/books/bookFilters.test.ts tests/books/bookRoutes.test.tsx`；预期新增筛选和配置断言失败。
- [ ] **步骤 3：实现筛选和配置入口。** 书架提供搜索、状态、作品类型和标签筛选及清除入口；设置入口提供快捷标签排序、移除和恢复默认；不删除完整标签库中的标签。
- [ ] **步骤 4：运行完整自动检查。** 运行 `npm.cmd test -- --runInBand`、`npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`npx.cmd expo-doctor`；检查 `git diff --check` 与 `git status --short`。
- [ ] **步骤 5：更新说明并提交。** 在 `README.md` 说明作品类型、标签、快捷标签和筛选；提交信息为 `feat: filter bookshelf by types and tags`。
- [ ] **步骤 6：请用户用 iPhone 验收。** 在 Expo Go 中新增一本书，选择“耽美”和两个标签；编辑快捷标签；回到书架用类型、标签和关键词筛选，确认结果正确。没有用户反馈时标记“待实机验证”，不能声称通过。

## 执行交接

每项依照红灯测试、最小实现、绿灯测试、本地提交的顺序执行。完成后再进入多次阅读、摘记图片、统计和 AI 文字识别计划；本计划不实现会员、联网书库或云同步。未经用户明确要求，不推送或合并 GitHub。
