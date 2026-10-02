# 摘记与精彩片段实施计划

> **供执行者阅读：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项实施本计划。任务进度使用复选框（`- [ ]`）记录。

**目标：** 在现有书籍和多次阅读记录基础上，实现可选的多条摘记、必填“我的想法”、可选多图片、精彩片段图库，以及按日期自动关联阅读次数。

**架构：** 在 SQLite 版本 5 上增加图片资源、摘记和图片关联表，使用本地文件系统保存图片。领域层用纯函数根据摘记本地日期和阅读记录计算关联，仓储层负责事务、图片引用和孤立文件清理；界面层在小说详情页增加摘记和精彩片段模块，沿用当前 Expo Router、React Native 和 Provider 刷新模式。

**技术栈：** Expo SDK 57、React Native、TypeScript、Expo SQLite、Expo Image Picker、Expo File System、Jest、Testing Library React Native。

**设计文档：** `docs/superpowers/specs/2026-10-02-reading-notes-and-highlights-design.md`

## 全局约束

- 一本书可以没有摘记；只有新增摘记时，“我的想法”去掉首尾空白后才是必填项。
- 摘记图片可选，可添加一张或多张；不允许保存只有图片、没有文字的摘记。
- 精彩片段是独立的书籍级图片集合，允许没有摘记也存在。
- 从精彩片段选择图片只增加关联，不复制文件；相册图片是否同步到精彩片段必须由用户确认。
- 不增加手动填写“第几次阅读”的控件；自动关联失败时仍允许保存并显示“未关联到具体阅读次数”。
- 当前阶段不实现 OCR、图片文字搜索、联网图片、云同步或大模型能力，但图片存储结构必须允许后续增加 OCR 索引。
- 不破坏现有书籍、评分、标签、主角和阅读历史；数据库迁移必须可重复执行。
- 书架卡片不显示摘记数量、图片数量或阅读次数；详情页的摘记和精彩片段区域默认展开。
- 文件复制、数据库写入和关联更新失败时保留表单输入，不能显示虚假的成功结果。

## 文件分工

- `src/storage/database.ts`：新增图片、摘记及关联表，版本升级到 6。
- `src/books/types.ts`：新增 `Note`、`ImageAsset`、`NoteImage`、`HighlightImage` 及创建/更新输入类型。
- `src/books/noteAssociation.ts`：根据本地日期和阅读记录计算自动关联的纯函数。
- `src/books/imageStorage.ts`：将相册资源复制到应用目录、删除未引用文件，并返回稳定路径。
- `src/books/notesRepository.ts`：摘记 CRUD、图片关联、精彩片段关联和事务操作。
- `src/books/NotesSection.tsx`、`src/books/NoteForm.tsx`：摘记列表、添加/编辑表单和验证提示。
- `src/books/HighlightsSection.tsx`、`src/books/imagePicker.ts`：精彩片段网格、相册多选、图库选择和图片权限处理。
- `src/books/BookDetail.tsx`、`src/app/book/[id].tsx`、`src/app/_layout.tsx`：详情页入口、刷新和摘记路由。
- `tests/books/migration.test.ts`、`tests/books/noteAssociation.test.ts`、`tests/books/notesRepository.test.ts`、`tests/books/NoteForm.test.tsx`、`tests/books/HighlightsSection.test.tsx`：迁移、领域、仓储和界面测试。

## Review Focus

- 只有空白“我的想法”时必须拒绝保存；纯图片摘记不能绕过校验。测试放在 `NoteForm.test.tsx`。
- 相册选择取消、拒绝权限或复制失败时，已输入文字和已选图片不能丢失。测试放在 `HighlightsSection.test.tsx` 和仓储失败测试。
- 同一图片同时被图库和摘记引用时，删除图库关联不得删除摘记仍在使用的本地文件。测试放在 `notesRepository.test.ts`。
- 阅读日期重叠或没有匹配范围时，必须选择最高阅读序号或返回 `null`，不能随机关联或阻止保存。测试放在 `noteAssociation.test.ts`。
- 旧数据库重复迁移时，原有书籍和阅读记录必须保持不变，不能重复建立系统表或数据。测试放在 `migration.test.ts`。

---

### 任务 1：数据库迁移与领域类型

**文件：**

- 修改：`src/storage/database.ts`
- 修改：`src/books/types.ts`
- 测试：`tests/books/migration.test.ts`

**接口：**

- 产生 `Note`、`ImageAsset`、`NoteImage`、`HighlightImage` 类型，以及 `NoteInput` 和 `ImageInput`。
- `migrateDatabase(db)` 保持现有签名，成功后 `PRAGMA user_version = 6`。

- [ ] **步骤 1：编写失败的迁移测试。** 覆盖全新数据库、当前 v5 数据库、重复迁移；断言 `image_assets`、`notes`、`note_images`、`highlight_images` 存在，旧书籍、评分、标签、主角和阅读记录数量不变，版本为 6。
- [ ] **步骤 2：运行迁移测试确认失败。**

运行：`npm test -- --runInBand tests/books/migration.test.ts`

预期：新增表和版本断言失败。

- [ ] **步骤 3：实现迁移。** 新增外键、级联删除、图片位置索引和 `notes.body NOT NULL`；使用 `CREATE TABLE IF NOT EXISTS`，仅在版本低于 6 时执行版本升级。
- [ ] **步骤 4：补充 TypeScript 领域类型。** 使用 camelCase 应用层字段，明确 `readingSessionId: string | null`、`body: string` 和图片位置为非负整数。
- [ ] **步骤 5：运行迁移和类型检查。**

运行：`npm test -- --runInBand tests/books/migration.test.ts`、`npx tsc --noEmit`

预期：测试通过，TypeScript 无错误。

- [ ] **步骤 6：提交。**

```bash
git add src/storage/database.ts src/books/types.ts tests/books/migration.test.ts
git commit -m "feat: add notes and image schema"
```

### 任务 2：摘记日期自动关联

**文件：**

- 创建：`src/books/noteAssociation.ts`
- 测试：`tests/books/noteAssociation.test.ts`

**接口：**

- `findReadingSessionForNote(noteDate: string, sessions: ReadingSession[]): string | null`
- 输入日期和现有 `ReadingSession[]`，只比较本地 `YYYY-MM-DD` 日期，不读取系统时区。

- [ ] **步骤 1：编写失败测试。** 覆盖已结束记录范围内匹配、在读记录从开始日期起匹配、范围重叠选择最高 `ordinal`、早于开始日期不匹配、没有记录返回 `null`、旧日期未记录占位不参与匹配。
- [ ] **步骤 2：运行测试确认失败。**

运行：`npm test -- --runInBand tests/books/noteAssociation.test.ts`

预期：函数不存在或断言失败。

- [ ] **步骤 3：实现纯函数。** 先过滤 `startedOn <= noteDate` 的记录；已结束记录要求 `noteDate <= endedOn`，在读记录只要求不早于开始日期；按 `ordinal` 降序取第一条。
- [ ] **步骤 4：运行测试确认通过。**

运行：`npm test -- --runInBand tests/books/noteAssociation.test.ts`

预期：全部关联规则测试通过。

- [ ] **步骤 5：提交。**

```bash
git add src/books/noteAssociation.ts tests/books/noteAssociation.test.ts
git commit -m "feat: associate notes with reading sessions"
```

### 任务 3：本地图片存储与摘记仓储

**文件：**

- 创建：`src/books/imageStorage.ts`
- 创建：`src/books/notesRepository.ts`
- 修改：`src/storage/AppProvider.tsx`
- 测试：`tests/books/notesRepository.test.ts`

**接口：**

- `ImageStorage.copyFromPicker(uri: string, bookId: string): Promise<ImageAsset>`
- `ImageStorage.removeIfUnreferenced(imageId: string): Promise<void>`
- `NotesRepository.listNotes(bookId: string): Promise<Note[]>`
- `NotesRepository.createNote(bookId: string, input: NoteInput): Promise<Note>`
- `NotesRepository.updateNote(bookId: string, noteId: string, input: NoteInput): Promise<Note>`
- `NotesRepository.deleteNote(bookId: string, noteId: string): Promise<void>`
- `NotesRepository.addHighlights(bookId: string, imageIds: string[]): Promise<void>`
- `NotesRepository.removeHighlight(bookId: string, imageId: string): Promise<void>`

- [ ] **步骤 1：编写失败的仓储测试。** 覆盖文字和图片关联的原子保存、一个摘记多张图片、摘记列表倒序、编辑替换图片、删除摘记、独立精彩片段、同图双重引用保护、图片不再被引用后的清理，以及事务失败回滚。
- [ ] **步骤 2：运行测试确认失败。**

运行：`npm test -- --runInBand tests/books/notesRepository.test.ts`

预期：仓储接口不存在或断言失败。

- [ ] **步骤 3：实现图片存储。** 使用 `expo-file-system` 将相册 URI 复制到应用目录，生成稳定 ID 和文件名；复制失败抛出错误，不写入数据库。
- [ ] **步骤 4：实现仓储事务。** 创建摘记时先校验 `trimmed body`，读取当前阅读记录并调用 `findReadingSessionForNote`，在一个 SQLite 独占事务中写入摘记和关联；图库与摘记共享 `image_assets`。
- [ ] **步骤 5：实现引用计数清理。** 只有图片同时不在 `note_images` 和 `highlight_images` 时才删除文件和资源行；删除图库关联不得影响摘记关联。
- [ ] **步骤 6：注入 Provider。** 暴露 `notesRepository`，沿用当前数据库初始化生命周期和详情页刷新方式。
- [ ] **步骤 7：运行仓储测试和类型检查。**

运行：`npm test -- --runInBand tests/books/notesRepository.test.ts`、`npx tsc --noEmit`

预期：仓储测试通过，TypeScript 无错误。

- [ ] **步骤 8：提交。**

```bash
git add src/books/imageStorage.ts src/books/notesRepository.ts src/storage/AppProvider.tsx tests/books/notesRepository.test.ts
git commit -m "feat: persist notes and highlight images"
```

### 任务 4：图片选择、精彩片段和权限处理

**文件：**

- 创建：`src/books/imagePicker.ts`
- 创建：`src/books/HighlightsSection.tsx`
- 测试：`tests/books/HighlightsSection.test.tsx`

**接口：**

- `pickImages(): Promise<string[]>`：使用 `expo-image-picker` 多选相册，取消返回空数组。
- `HighlightsSection({ bookId, images, onChanged })`：展示网格、批量添加、预览和删除。
- `HighlightsSection` 同时提供“选择现有精彩片段”的回调给 `NoteForm`，返回图片 ID 而非复制 URI。

- [ ] **步骤 1：编写失败界面测试。** 覆盖精彩片段空状态、批量选择、取消选择、拒绝权限提示、删除确认、已有图片被摘记引用时仍保留文件，以及选择现有图片回调返回 ID。
- [ ] **步骤 2：实现 `imagePicker.ts`。** 请求相册权限并使用 `allowsMultipleSelection: true`；权限拒绝、取消和空结果均返回可区分的非异常结果。
- [ ] **步骤 3：实现精彩片段网格。** 加载仓储数据，按 position 展示，添加多张相册图片并在成功后刷新；删除前二次确认。
- [ ] **步骤 4：运行界面测试。**

运行：`npm test -- --runInBand tests/books/HighlightsSection.test.tsx`

预期：组件行为测试通过。

- [ ] **步骤 5：提交。**

```bash
git add src/books/imagePicker.ts src/books/HighlightsSection.tsx tests/books/HighlightsSection.test.tsx
git commit -m "feat: add highlights gallery"
```

### 任务 5：摘记表单与详情页集成

**文件：**

- 创建：`src/books/NoteForm.tsx`
- 创建：`src/books/NotesSection.tsx`
- 修改：`src/books/BookDetail.tsx`
- 修改：`src/app/book/[id].tsx`
- 修改：`src/app/_layout.tsx`
- 测试：`tests/books/NoteForm.test.tsx`、`tests/books/BookDetail.test.tsx`

**接口：**

- `NoteForm({ bookId, note, highlights, onSaved, onCancel })`：保存 `NoteInput`，不暴露手动阅读次数字段。
- `NotesSection({ bookId, notes, highlights, onChanged })`：列表、编辑、删除和新增入口。

- [ ] **步骤 1：编写失败表单测试。** 覆盖空白正文拒绝、文字无图片保存、选择多张图库图片、相册选择“是”时同时加入精彩片段、选择“否”时只关联摘记、保存失败保留输入。
- [ ] **步骤 2：实现 `NoteForm`。** 使用多行输入框，保存前 `trim`；添加图片菜单区分“从精彩片段选择”和“从相册选择”；相册选择后显示同步确认；图片为可选。
- [ ] **步骤 3：实现 `NotesSection`。** 按创建时间倒序展示文本、日期、图片缩略图和“第 N 次阅读后／未关联到具体阅读次数”；提供编辑和删除确认。
- [ ] **步骤 4：集成详情页。** 在阅读历史之后增加“摘记”和“精彩片段”两个默认展开模块；页面获得焦点时同时刷新书籍、阅读历史、摘记和图库；书架卡片不增加新字段。
- [ ] **步骤 5：注册路由。** 新增摘记页面路由，编辑时通过 `noteId` 加载已有内容；返回详情页只在保存成功后发生。
- [ ] **步骤 6：运行目标测试。**

运行：`npm test -- --runInBand tests/books/NoteForm.test.tsx tests/books/BookDetail.test.tsx`

预期：新增摘记、编辑、删除、图片复用和详情页刷新测试通过。

- [ ] **步骤 7：提交。**

```bash
git add src/books/NoteForm.tsx src/books/NotesSection.tsx src/books/BookDetail.tsx src/app/book/[id].tsx src/app/_layout.tsx tests/books/NoteForm.test.tsx tests/books/BookDetail.test.tsx
git commit -m "feat: add notes and highlights to book details"
```

### 任务 6：阅读日期变更后的关联刷新与收尾验证

**文件：**

- 修改：`src/books/readingHistoryRepository.ts`
- 修改：`src/books/notesRepository.ts`
- 修改：必要的详情页刷新代码
- 测试：`tests/books/readingHistoryRepository.test.ts`、`tests/books/notesRepository.test.ts`

- [ ] **步骤 1：编写失败测试。** 修改一条阅读记录的开始／结束日期后，相关摘记重新关联；删除或新增阅读记录后，未匹配摘记仍可显示且不会丢失。
- [ ] **步骤 2：实现重新计算。** 阅读日期事务成功后，按受影响书籍重新计算所有摘记的 `reading_session_id`；若无匹配写入 `NULL`。
- [ ] **步骤 3：运行针对性回归测试。**

运行：`npm test -- --runInBand tests/books/readingHistoryRepository.test.ts tests/books/notesRepository.test.ts tests/books/noteAssociation.test.ts`

预期：相关测试通过。

- [ ] **步骤 4：运行一次完整本地验证。**

运行：`npm test -- --runInBand`、`npx tsc --noEmit`、`npm run lint`

预期：Jest、TypeScript 和 lint 均成功；不重复运行 Expo Doctor，除非新增原生依赖或出现打包异常。

- [ ] **步骤 5：真机验收。** 在 iPhone Expo Go 中验证：无图片摘记、带多图摘记、图库复用、相册同步“是／否”、空白文字拦截、跨阅读日期自动关联和编辑阅读日期后的关联刷新。

- [ ] **步骤 6：提交收尾。**

```bash
git add src tests
git commit -m "test: verify reading notes and highlights"
```

