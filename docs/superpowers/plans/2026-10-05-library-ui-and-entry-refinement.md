# 书架与录入体验精修 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task, or `superpowers:subagent-driven-development` if the user explicitly chooses delegation. Steps use checkbox (`- [ ]`) syntax for tracking. Read the spec first.

**Goal / 目标：** 修复 iPhone 书架顶部重叠和操作反馈问题，精简书架及管理页布局，重排添加／编辑流程，并补齐首发平台、历史建议、完整标签入口和更易读的默认封面。

**Architecture / 架构：** 保留现有 Expo Router 三栏导航、仓储层和主题系统，以小型共享控件统一选中态和底部面板；`BookshelfScreen` 继续持有搜索、筛选、排序和批量选择状态。添加／编辑路由只负责读取现有书目与标签并形成表单输入，表单负责草稿状态；新建自定义标签与书目在同一仓储事务内提交，避免取消表单后遗留无主标签。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、`react-native-safe-area-context`、现有 SQLite 仓储与 Jest；不新增依赖。Windows 命令使用 `npm.cmd`／`npx.cmd`。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-04-navigation-and-visual-refresh-design.md`；筛选边界同时遵守 `docs/superpowers/specs/2026-10-02-library-search-and-filtering-design.md`。

## Global Constraints / 全局约束

- 底部导航仍只有 `书架`、`回顾`、`管理`；书库概览、年度回顾和主题回顾只属于“回顾”，数据维护与外观只属于“管理”。
- 阅读状态是书架一级分区，不计入类型／标签筛选数；“重置筛选”只清除作品类型和标签，搜索词由输入框 `×` 清除，状态由页签切换，排序保持不变。
- 书架常驻工具只显示“排序”“筛选”“更多”；“批量整理”和“随机想读”放入“更多”底部面板。
- 新增小说时书名是唯一必填字段；阅读状态位于最上方。“为什么想看”只在“想读”时显示和保存，但切换状态时保留当前表单草稿；编辑已有小说时，已保存理由不能因状态变化失去入口。
- 用户界面统一称“首发平台”；数据库、导入导出和 TypeScript 内部字段继续使用 `platform`，本轮不做 schema 迁移。每本书只保存一个可选自由文本值。
- 作者和首发平台建议直接来自当前书库的非空去重值；仍允许自由输入，不建立独立历史表。新增自定义标签不自动成为快捷标签。
- 默认主题仍为墨绿，其他七个预设保留；选中控件统一使用当前主题主色底、白字和可访问选中状态。评分与错误继续使用独立语义色。
- 蓝色齿轮属于 Expo Go 调试悬浮控件，不在应用中复制、隐藏或预留位置。
- 遵循用户的测试偏好：每项只运行相关定向测试；收尾运行一次 TypeScript、lint 和差异检查，不反复运行全量 Jest。
- 未在 iPhone Expo Go 真机验证前，不声称安全区、键盘、底部面板和窄屏布局已经通过实机验收。

## Review Focus

- 仅切换到“想读／在读／读完／弃读”或仅输入关键词时，不应出现类型／标签的“重置筛选”；任务 2 测试。
- 快速开关排序、筛选、更多面板以及连续搜索时，旧面板和旧查询结果不能覆盖当前状态；任务 2 测试。
- 新建非“想读”书时，暂存的想看理由不应写入数据库；切回“想读”后草稿仍在；任务 4 测试。
- 作者／首发平台存在空白、大小写或重复值，以及书库读取失败时，建议列表应去重且表单仍允许自由输入；任务 4 测试。
- 创建自定义标签后书目保存失败或事务回滚时，不应留下孤立标签；任务 4 仓储测试。

---

## 文件分工

- 新建 `src/ui/ChoiceChip.tsx`、`src/ui/BottomSheet.tsx` 与 `tests/ui/ChoiceChip.test.tsx`、`tests/ui/BottomSheet.test.tsx`：统一单选／多选反馈和底部面板行为。
- 修改 `src/books/TypePicker.tsx`、`src/books/TagPicker.tsx` 及其测试：复用 `ChoiceChip`，选中态统一为主色底、白字和选中状态。
- 新建 `src/books/BookshelfToolsSheet.tsx`、`src/books/BulkSelectionBar.tsx` 及对应测试；修改 `src/books/BookshelfToolbar.tsx`、`src/books/BookshelfScreen.tsx`、`tests/books/BookshelfToolbar.test.tsx`、`tests/books/bookRoutes.test.tsx`：安全区、工具面板、独立清除语义和紧凑批量模式。
- 新建 `src/books/bookFieldSuggestions.ts`、`src/books/SuggestionTextInput.tsx`、`src/books/BookTagSheet.tsx` 及对应测试；修改 `src/books/AddBookForm.tsx`、`src/books/BookEditForm.tsx`、两个表单测试和新增／编辑路由：字段顺序、条件显示、建议值和完整标签入口。
- 修改 `src/books/types.ts`、`src/books/validation.ts`、`src/books/sqliteRepository.ts`、`tests/books/sqliteRepository.test.ts`：允许新建书目在同一事务中创建并关联自定义标签。
- 新建 `src/settings/SettingsRow.tsx`、`src/app/settings/appearance.tsx`；修改 `src/app/(tabs)/manage.tsx`、`src/app/_layout.tsx`、`src/theme/ThemePicker.tsx`、导航及主题测试：管理页分组、独立外观页和可理解的返回标题。
- 修改 `src/books/BookCover.tsx`、`src/books/BookCard.tsx`、`tests/books/BookCover.test.tsx`、`tests/books/bookRoutes.test.tsx`：默认封面与书卡视觉精修。

### Task 1：统一选择控件与底部面板

**Files:** Create `src/ui/ChoiceChip.tsx`, `src/ui/BottomSheet.tsx`, `tests/ui/ChoiceChip.test.tsx`, `tests/ui/BottomSheet.test.tsx`; modify `src/books/TypePicker.tsx`, `src/books/TagPicker.tsx`, `tests/books/TypePicker.test.tsx`, `tests/books/TagPicker.test.tsx`.

**Interfaces:** `ChoiceChip({ label, selected, selectionRole, onPress, disabled? }: { label: string; selected: boolean; selectionRole: 'radio' | 'checkbox'; onPress(): void; disabled?: boolean })`；`BottomSheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose(): void; children: React.ReactNode })`。`ChoiceChip` 从 `useTheme()` 取色，不接受页面自定义选中色；`BottomSheet` 使用 `Modal`，响应遮罩、关闭按钮和 `onRequestClose`，底部内边距来自安全区。

- [ ] **Step 1: Write the failing tests.** 断言选中单选／多选均为 `theme.primary` 背景、白字、正确的 `accessibilityState.checked`，未选为白底中性边框；禁用态不触发回调。断言底部面板关闭时不渲染内容，打开时显示标题，遮罩、关闭按钮和系统返回均调用 `onClose`。
- [ ] **Step 2: Run red.** `npm.cmd test -- --runInBand tests/ui/ChoiceChip.test.tsx tests/ui/BottomSheet.test.tsx tests/books/TypePicker.test.tsx tests/books/TagPicker.test.tsx`；预期新模块缺失或旧选中样式断言失败。
- [ ] **Step 3: Implement the shared controls.** 添加上述签名；`TypePicker`、`TagPicker` 仅替换选项渲染，不改变单选、多选、搜索或创建标签语义。选中提示使用颜色加勾选／无障碍状态，不能只改文字颜色。
- [ ] **Step 4: Run green.** 重跑步骤 2，预期全部通过。
- [ ] **Step 5: Commit.** 提交 `refactor: unify selection controls`。

### Task 2：书架安全区、工具栏与独立筛选语义

**Files:** Create `src/books/BookshelfToolsSheet.tsx`, `tests/books/BookshelfToolsSheet.test.tsx`; modify `src/books/BookshelfToolbar.tsx`, `src/books/BookshelfScreen.tsx`, `tests/books/BookshelfToolbar.test.tsx`, `tests/books/bookRoutes.test.tsx`.

**Interfaces:** `type BookshelfSheet = 'sort' | 'filter' | 'more' | null`。`BookshelfToolbar` 接收 `activeSheet`、`onOpenSheet(sheet)`、`onClearQuery()`、状态计数、查询值、当前排序标题和 `activeFilterCount`；不再接收 `hasConditions` 或负责直接清空所有条件。`BookshelfToolsSheet` 接收当前排序、类型、标签、相应变更回调、`onResetFilters()`、`onEnterBulk()`、`onRandomPick()` 和 `onClose()`。

- [ ] **Step 1: Write the failing tests.** 断言书架使用顶部安全区且标题为“我的书架”；五个状态单行横向滚动，选中项为深底白字。搜索框有独立 `×`；排序／筛选面板打开时对应按钮变深，排序当前项有勾选；类型或标签生效时显示“筛选 N”。仅状态或关键词变化时不显示“重置筛选”，重置后保留状态、关键词和排序。更多面板包含“批量整理”和“随机想读”。快速切换面板时只保留最后一个面板。
- [ ] **Step 2: Run red.** `npm.cmd test -- --runInBand tests/books/BookshelfToolbar.test.tsx tests/books/BookshelfToolsSheet.test.tsx tests/books/bookRoutes.test.tsx`；预期旧常驻按钮、清除行为或布局断言失败。
- [ ] **Step 3: Implement the toolbar flow.** `BookshelfScreen` 用 `SafeAreaView` 的顶部边界承载标题和工具区；标题移除大幅宣传语。将当前内联排序和筛选区域迁入 `BookshelfToolsSheet`，用单一 `activeSheet` 控制互斥显示；`resetFilters()` 只执行 `setBookType(null)` 和 `setTagIds([])`，搜索 `×` 只执行 `setQuery('')`。
- [ ] **Step 4: Implement reason-specific empty states.** 当前状态无书时显示“还没有想读的小说”等状态文案；有关键词时提供清除关键词，有类型／标签时提供调整或重置筛选，不能一律提示“清除筛选”。
- [ ] **Step 5: Run green.** 重跑步骤 2，预期全部通过。
- [ ] **Step 6: Commit.** 提交 `feat: refine bookshelf filters and tools`。

### Task 3：紧凑批量整理模式

**Files:** Create `src/books/BulkSelectionBar.tsx`, `tests/books/BulkSelectionBar.test.tsx`; modify `src/books/BookshelfScreen.tsx`, `tests/books/bookRoutes.test.tsx`.

**Interfaces:** `BulkSelectionBar({ selectedCount, canSelectAll, onCancel, onShowSelected, onSelectAll }: { selectedCount: number; canSelectAll: boolean; onCancel(): void; onShowSelected(): void; onSelectAll(): void })`。`BookshelfScreen` 在批量模式底部显示 `整理所选`，仅 `selectedCount > 0` 可用；选中清单继续复用现有稳定书籍 ID `Map`。

- [ ] **Step 1: Write the failing tests.** 进入批量模式后断言大块浅绿操作面板消失，只显示“取消、已选 N 本、全选当前结果”和底部“整理所选”；未选书时底部按钮禁用，选中后可打开现有整理预览。批量模式隐藏“添加小说”，取消后清空选择并恢复添加按钮；跨筛选保留已选稳定 ID。
- [ ] **Step 2: Run red.** `npm.cmd test -- --runInBand tests/books/BulkSelectionBar.test.tsx tests/books/bookRoutes.test.tsx tests/books/BulkOrganizePanel.test.tsx`；预期旧四项文字面板仍存在。
- [ ] **Step 3: Implement the compact mode.** 用 `BulkSelectionBar` 替换 `bulkBar`；“已选 N 本”打开紧凑已选清单，“整理所选”进入现有 `BulkOrganizePanel`。底部按钮使用安全区定位并与列表留白同步；普通添加按钮与批量按钮永不同时显示。
- [ ] **Step 4: Run green.** 重跑步骤 2，预期全部通过。
- [ ] **Step 5: Commit.** 提交 `feat: simplify bulk book selection`。

### Task 4：添加／编辑流程、首发平台建议与完整标签库

**Files:** Create `src/books/bookFieldSuggestions.ts`, `src/books/SuggestionTextInput.tsx`, `src/books/BookTagSheet.tsx`, `tests/books/bookFieldSuggestions.test.ts`, `tests/books/SuggestionTextInput.test.tsx`, `tests/books/BookTagSheet.test.tsx`; modify `src/books/AddBookForm.tsx`, `src/books/BookEditForm.tsx`, `src/app/book/new.tsx`, `src/app/book/[id]/edit.tsx`, `src/books/types.ts`, `src/books/validation.ts`, `src/books/sqliteRepository.ts`, `tests/books/addBook.test.tsx`, `tests/books/BookEditForm.test.tsx`, `tests/books/bookRoutes.test.tsx`, `tests/books/sqliteRepository.test.ts`.

**Interfaces:** `collectBookFieldSuggestions(books: readonly Book[], field: 'author' | 'platform', limit?: number): string[]` 保留 `repo.list()` 的最近修改顺序，去除空白并按 `toLocaleLowerCase()` 去重，默认最多 8 项。`SuggestionTextInput({ label, placeholder, value, suggestions, onChangeText }: { label: string; placeholder: string; value: string; suggestions: readonly string[]; onChangeText(value: string): void })` 只在聚焦或有输入时显示匹配建议。`BookTagSheet({ visible, tags, selectedIds, onChange, onCreateTag, onClose }: { visible: boolean; tags: Tag[]; selectedIds: string[]; onChange(ids: string[]): void; onCreateTag(name: string): Promise<Tag>; onClose(): void })`。`AddBookForm` 新增 `allTags?: Tag[]`、`authorSuggestions?: string[]`、`platformSuggestions?: string[]`；`BookEditForm` 新增两个建议数组，继续使用既有 `allTags`。`BookInput` 新增可选 `newTags?: Pick<Tag, 'id' | 'name'>[]`，规则与 `BookEditInput.newTags` 一致。

- [ ] **Step 1: Write the failing suggestion tests.** 覆盖空值、首尾空白、大小写重复、超过 8 项、输入过滤和点击回填；书库读取失败时页面显示非阻塞提示，但作者和首发平台仍可自由输入。
- [ ] **Step 2: Write the failing form tests.** 断言阅读状态排在表单最前；新增“想读”显示“为什么想看”，切到其他状态后隐藏但切回仍保留草稿，直接以非“想读”保存时提交 `whyWantToRead: null`。编辑非“想读”但已有理由的书仍显示并可修改。界面只出现“首发平台”，不出现“阅读平台”。作者／平台建议可点选。
- [ ] **Step 3: Write the failing tag and repository tests.** 添加页只平铺快捷标签并显示“全部标签（N）”；完整面板可搜索、多选和创建自定义标签，新标签不会进入 `listQuick()`。`repo.create()` 成功时在同一事务插入 `tags` 与 `book_tags`；书目插入、关联或封面复制失败时回滚新标签。
- [ ] **Step 4: Run red.** `npm.cmd test -- --runInBand tests/books/bookFieldSuggestions.test.ts tests/books/SuggestionTextInput.test.tsx tests/books/BookTagSheet.test.tsx tests/books/addBook.test.tsx tests/books/BookEditForm.test.tsx tests/books/sqliteRepository.test.ts tests/books/bookRoutes.test.tsx`；预期新模块、字段顺序、文案或事务断言失败。
- [ ] **Step 5: Implement data support.** 扩展 `BookInput`、`normalizeBookCreate()` 和 `SqliteBookRepository.create()`；校验新标签必须非空、ID／名称不重复且已包含于 `tagIds`，并在插入 `book_tags` 前于同一事务创建标签。验证错误文案使用“首发平台”。
- [ ] **Step 6: Implement route data and form flow.** 新增页并行读取 `listQuick()`、`list()` 与 `repo.list()`；编辑页在现有加载中加入 `repo.list()`。两页使用纯函数生成建议。表单顺序固定为状态、书名、作者、首发平台、条件字段、作品类型、标签、主角、封面、保存；日期和评分沿用现有状态规则。
- [ ] **Step 7: Implement full tag selection.** 快捷标签使用共享选中控件；“全部标签”打开 `BookTagSheet`。新增标签先作为表单待提交数据，保存书目时通过 `newTags` 一并提交；取消表单不写数据库，也不自动加入快捷标签。
- [ ] **Step 8: Run green.** 重跑步骤 4，预期全部通过。
- [ ] **Step 9: Commit.** 提交 `feat: improve book entry metadata flow`。

### Task 5：管理页分组、外观子页与返回标题

**Files:** Create `src/settings/SettingsRow.tsx`, `src/app/settings/appearance.tsx`, `tests/navigation/appearancePage.test.tsx`; modify `src/app/(tabs)/manage.tsx`, `src/app/_layout.tsx`, `src/theme/ThemePicker.tsx`, `tests/navigation/tabs.test.tsx`, `tests/theme/ThemePicker.test.tsx`.

**Interfaces:** `SettingsRow({ icon, title, description, value?, onPress }: { icon: ComponentProps<typeof Ionicons>['name']; title: string; description: string; value?: string; onPress(): void })`。管理首页四组为“标签与分类”“导入与整理”“导出与安全”“外观”；外观行只显示当前 `theme.name` 与色点，按下进入 `/settings/appearance`，完整 `ThemePicker` 只在该页面渲染。

- [ ] **Step 1: Write the failing tests.** 管理首页按四组显示紧凑行，不直接出现八个主题卡；外观行显示当前“墨绿”并跳转外观页。外观页仍显示全部八个主题并可保存。根 Stack 为 `(tabs)`、新增、详情、编辑和设置子页提供用户可读标题／返回标题，渲染配置中不出现 `(tabs)`。
- [ ] **Step 2: Run red.** `npm.cmd test -- --runInBand tests/navigation/tabs.test.tsx tests/navigation/appearancePage.test.tsx tests/theme/ThemePicker.test.tsx`；预期管理页仍直接展开主题或新路由缺失。
- [ ] **Step 3: Implement grouped management.** 使用 `SettingsRow` 替换大按钮；标签页标题改为“标签与分类”，旧记录导入归入“导入与整理”，开放导出和备份归入“导出与安全”。回顾入口不出现在管理页。
- [ ] **Step 4: Implement navigation labels.** 注册 `settings/appearance`；为书架、小说详情、添加、编辑和设置页配置明确标题／`headerBackTitle` 或等价的最小返回显示，确保 iOS 不暴露路由组名。
- [ ] **Step 5: Run green.** 重跑步骤 2，预期全部通过。
- [ ] **Step 6: Commit.** 提交 `feat: streamline management navigation`。

### Task 6：默认封面与书卡视觉精修

**Files:** Modify `src/books/BookCover.tsx`, `src/books/BookCard.tsx`, `tests/books/BookCover.test.tsx`, `tests/books/bookRoutes.test.tsx`.

**Interfaces:** 保留现有 `BookCover` props 和 `getDefaultCoverStyle(bookId)`；为 `small`、`medium`、`large` 分别定义封面内边距、标题字号和行高，不改变稳定 ID 配色。书卡评分固定格式为 `★ ${(ratingHalfStars / 2).toFixed(1)}`。

- [ ] **Step 1: Write the failing tests.** 小封面的三字书名仍在不超过三行的标题节点中，字号／内边距使用小尺寸令牌；默认封面没有粗短横线和英文品牌，长标题截断且不溢出。真实图片仍优先。书卡显示 `★ 5.0`、主题正文／次要文字色，不显示 `5 / 5 星`。
- [ ] **Step 2: Run red.** `npm.cmd test -- --runInBand tests/books/BookCover.test.tsx tests/books/bookRoutes.test.tsx`；预期横线或旧评分格式断言失败。
- [ ] **Step 3: Implement visual refinements.** 减小小封面圆角、边框、内边距和字号，移除 `accentLine`；不同尺寸使用独立排版令牌。压缩书卡垂直间距并用主题色渲染标题、作者和命中摘要，仍完整保留正文书名和现有点击／选择行为。
- [ ] **Step 4: Run green.** 重跑步骤 2，预期全部通过。
- [ ] **Step 5: Commit.** 提交 `style: polish book cards and default covers`。

### Task 7：集成检查与 iPhone 验收交接

**Files:** Modify only failing files found by checks; update `README.md` only if implementation changes a documented navigation path or label not already synchronized.

**Interfaces:** 不新增接口；本任务验证前六项组合后的真实行为。

- [ ] **Step 1: Run the single focused regression command.** `npm.cmd test -- --runInBand tests/ui tests/books/BookshelfToolbar.test.tsx tests/books/BookshelfToolsSheet.test.tsx tests/books/BulkSelectionBar.test.tsx tests/books/addBook.test.tsx tests/books/BookEditForm.test.tsx tests/books/bookFieldSuggestions.test.ts tests/books/SuggestionTextInput.test.tsx tests/books/BookTagSheet.test.tsx tests/books/TypePicker.test.tsx tests/books/TagPicker.test.tsx tests/books/sqliteRepository.test.ts tests/books/BookCover.test.tsx tests/books/bookRoutes.test.tsx tests/navigation/tabs.test.tsx tests/navigation/appearancePage.test.tsx tests/theme/ThemePicker.test.tsx`；预期全部通过。
- [ ] **Step 2: Run static checks once.** `npx.cmd tsc --noEmit`、`npm.cmd run lint`、`git diff --check`；预期零错误。用 `rg -n "阅读平台|\(tabs\)" src` 检查用户界面残留，只允许内部注释或测试用的路由注册名称。
- [ ] **Step 3: Review the diff against the spec.** 逐项核对安全区、清除边界、三个工具按钮、批量模式、条件表单、建议值、完整标签、管理分组、返回标题和默认封面；不顺手加入国际化、云同步或新的书籍字段。
- [ ] **Step 4: Commit final fixes.** 如有必要提交 `fix: complete library UI refinement`；工作区必须干净。未获明确授权不合并或推送。
- [ ] **Step 5: Hand off the minimal iPhone checklist.** 只要求用户验证：顶部不重叠；状态／搜索／筛选独立；三个底部面板；批量按钮不遮挡；键盘下可滚动；新增非想读与已保存想看理由；作者／首发平台建议；全部标签；管理页与外观页；三字／长书名默认封面和返回标题。
