# 全应用 iOS 风格 UI 重构 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task, or `superpowers:subagent-driven-development` if the user explicitly chooses delegation. Steps use checkbox (`- [ ]`) syntax for tracking. Read the spec first.

**Goal / 目标：** 让现有 Novel Tracker 全部页面采用统一、清爽的 iOS 风格，保留八套主题和所有已实现的功能与数据规则，并达到真机发布候选验收标准。

**Architecture / 架构：** 保留 Expo Router 的三栏 Tabs、根 Stack、现有仓储和业务表单状态。在 `src/ui` 增加少量共用视觉组件及尺寸令牌，逐页迁移外层布局、导航、安全区、分组行和操作反馈；封面、评分、标签、摘记及回顾卡片继续使用现有业务组件和数据流。

**Tech Stack / 技术栈：** Expo SDK 57、React Native 0.86、Expo Router、TypeScript、现有 Jest/React Native Testing Library；Windows 命令使用 `npm.cmd` 和 `npx.cmd`。新增依赖前按 `AGENTS.md` 核对 SDK 57 文档，优先不新增依赖。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-09-ios-ui-redesign-design.md`

## Global Constraints / 全局约束

- 仅调整 UI 与页面上的操作位置；不得修改数据库 schema、导入导出格式、备份数据、搜索范围、阅读状态转换、OCR、评分、日期或统计口径。
- 保留 `书架／回顾／管理` 三栏、现有路由目的页、默认墨绿与八套可选主题，语义色继续来自 `ThemeProvider`；评分和危险操作不使用主题主色代替。
- 添加页顶部显示封面与书名，基本信息组包含作者、首发平台和可增至任意个的主角；没有“低频内容／其他资料”组，书名仍是新增时唯一必填字段。
- 详情页的阅读记录、摘记、精彩片段等默认展开；所有已有入口继续可达。
- 八套预设目前均为浅色方案，本轮将 `app.json` 的 `userInterfaceStyle` 设为 `light`，避免系统深色模式出现混搭；改配置前核对 Expo SDK 57 文档。iPhone 安全区、键盘、文字放大和已声明支持的 iPad 都要验收。
- 分阶段只跑改动相关测试；全部页面完成后跑一次完整自动化检查和真机关键流程。未做过的真机、生产构建或 App Store 检查不得标记“通过”。

## Review Focus

- 第三个及之后的主角输入框被键盘覆盖：焦点字段与保存操作应能滚动到可见区域；任务 3 的表单测试和任务 8 真机检查。
- 长书名、长作者名、缺封面和大字号：书架行与详情顶部不能溢出或压住评分/操作；任务 2、4 的组件测试及任务 8 视觉检查。
- 搜索命中摘记或图片文字并从详情返回：两种命中摘要保留，图片命中的 `focusImageId` 仍传给详情，书架查询状态不丢；任务 2、4 的路由测试。
- 旧记录导入预览中的大量候选、错误和重复项：滚动、选择和确认按钮始终可用，不会绕过原确认；任务 7 的导入页面测试。
- 切换主题或系统深色外观时的弹层、输入、错误与危险按钮：保持浅色方案及文字可读，主题偏好不改书籍数据；任务 1、7 的测试和任务 8 真机检查。

---

## 文件分工

- 共用 UI：新增 `src/ui/layout.ts`、`src/ui/TabPageHeader.tsx`、`src/ui/GroupedSection.tsx`、`src/ui/ActionRow.tsx`；修改 `src/ui/BottomSheet.tsx`、`src/ui/ChoiceChip.tsx`，新增 `tests/ui/GroupedSection.test.tsx`、`tests/ui/ActionRow.test.tsx`。共用组件只处理布局和视觉，不访问业务仓储。
- 导航：修改 `src/app/_layout.tsx`、`src/app/(tabs)/_layout.tsx`、`src/app/(tabs)/index.tsx`、`src/app/(tabs)/recap.tsx`、`src/app/(tabs)/manage.tsx` 和 `app.json`（将界面外观与浅色主题一致）。
- 书架：修改 `src/books/BookshelfScreen.tsx`、`BookshelfToolbar.tsx`、`BookshelfToolsSheet.tsx`、`BookCard.tsx`、`BulkSelectionBar.tsx`、`RandomWantToReadSheet.tsx`、`QuickRecordSheet.tsx`；继续使用现有 `useBookSearch` 和仓储接口。
- 录入：修改 `src/books/AddBookForm.tsx`、`BookEditForm.tsx`、`BookCoverField.tsx`、`SuggestionField.tsx`、`ReadingDateFields.tsx`、`RatingField.tsx`、`TypePicker.tsx`、`TagPicker.tsx` 及 `src/app/book/new.tsx`、`src/app/book/[id]/edit.tsx`。
- 详情：修改 `src/books/BookDetail.tsx`、`ReadingHistoryForm.tsx`、`NoteForm.tsx`、`NotesSection.tsx`、`HighlightsSection.tsx`、`ImagePreview.tsx`、`src/app/book/[id].tsx`、`src/app/book/[id]/reading/[sessionId].tsx`。
- 回顾：修改 `src/app/settings/overview.tsx`、`annual-recap.tsx`、`annual-summary.tsx`、`themed-recap.tsx`、`recap-share.tsx`；页面外壳可以调整，现有分享卡片内容与统计快照保持原规则。
- 管理与数据：修改 `src/app/(tabs)/manage.tsx`、`src/app/settings/data.tsx`、`tags.tsx`、`appearance.tsx`、`data-safety.tsx`、`import.tsx`、`export.tsx`、`backup.tsx` 及页面使用的 `src/import` 视图组件；保留原服务与确认逻辑。
- 测试优先扩展现有 `tests/navigation`、`tests/books`、`tests/import`、`tests/backup`、`tests/export`、`tests/theme`，只为共用 UI 新建必要测试文件，不做间距快照测试。

### 任务 1：共用视觉规则与导航安全区

**文件：** 新建 `src/ui/layout.ts`、`TabPageHeader.tsx`、`GroupedSection.tsx`、`ActionRow.tsx`、`tests/ui/TabPageHeader.test.tsx`、`tests/ui/GroupedSection.test.tsx`、`tests/ui/ActionRow.test.tsx`；修改 `src/ui/BottomSheet.tsx`、`ChoiceChip.tsx`、`src/app/_layout.tsx`、`src/app/(tabs)/_layout.tsx`、`app.json`、`tests/navigation/tabs.test.tsx`、`tests/ui/BottomSheet.test.tsx`。

**Interfaces：** `UI_LAYOUT = { pageInset: 16, sectionGap: 20, groupRadius: 14, rowMinHeight: 48, bottomActionGap: 12 } as const`；`TabPageHeader({ title, subtitle? }: { title: string; subtitle?: string })` 负责 Tab 首页的安全区顶部与大标题；`GroupedSection({ title?, children }: PropsWithChildren<{ title?: string }>)` 负责分组标题和白色内容面；`ActionRow({ label, detail?, value?, onPress, danger? }: { label: string; detail?: string; value?: string; onPress(): void; danger?: boolean })` 负责可点击的整行入口。组件全部从 `useTheme()` 取色。

- [ ] **步骤 1：写失败测试。** `GroupedSection` 渲染标题与子项，`ActionRow` 有可访问的按钮名称且点击只触发一次；`TabPageHeader` 在有顶部安全区时为标题留空间；底部面板在任意主题仍可关闭、滚动并避开底部安全区；Tabs 仍只有三项且返回文案不暴露 `(tabs)`。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/ui/TabPageHeader.test.tsx tests/ui/GroupedSection.test.tsx tests/ui/ActionRow.test.tsx tests/ui/BottomSheet.test.tsx tests/navigation/tabs.test.tsx`；预期新组件缺失或新断言失败。
- [ ] **步骤 3：实现共用组件。** 使用现有 React Native、`react-native-safe-area-context` 和主题上下文；共用组件不接触书籍数据。为按下、选中、禁用和危险态使用一致视觉反馈；Stack 标题与 Tabs 色彩统一。核对 Expo SDK 57 文档后把应用外观固定为浅色，不添加新的导航页。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2，预期通过；提交 `refactor: establish shared iOS-style layout`。

### 任务 2：书架与搜索整理区

**文件：** 修改 `src/books/BookshelfScreen.tsx`、`BookshelfToolbar.tsx`、`BookshelfToolsSheet.tsx`、`BookCard.tsx`、`BulkSelectionBar.tsx`、`RandomWantToReadSheet.tsx`、`QuickRecordSheet.tsx`；扩展 `tests/books/bookRoutes.test.tsx`、`BookCard.test.tsx`、`BookshelfToolbar.test.tsx`。

**Interfaces：** 书架继续持有现有 `query/status/bookType/tagIds/sortOrder/bulkMode` 状态；共用 `TabPageHeader` 只接收标题，`BookCard` 的 `matchedNoteSnippet`、`matchedImage`、`selection`、`onQuickRecord` props 保持不变。书架搜索、排序、筛选与随机抽取仍由现有 hook 和仓储执行。

- [ ] **步骤 1：写失败测试。** 书架显示紧凑标题、五状态、搜索及三工具入口；`BookCard` 的长书名/作者可换行或截断但评分与封面仍可读；仅“在读”显示快捷记录；批量模式保留选择与整理、隐藏添加小说；摘记与图片文字命中摘要仍显示，图片命中跳转仍带 `focusImageId`。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/bookRoutes.test.tsx tests/books/BookCard.test.tsx tests/books/BookshelfToolbar.test.tsx`；预期新布局或入口断言失败。
- [ ] **步骤 3：实现书架布局。** 标题、状态、搜索、工具、列表逐级排列；书卡缩短空白和主题色面积；添加按钮和列表尾部按安全区留空。保持当前清除筛选边界、排序反馈、空状态、首次使用卡片、随机抽取及错误重试。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2，预期通过；提交 `refactor: refresh bookshelf presentation`。

### 任务 3：添加与编辑表单

**文件：** 修改 `src/books/AddBookForm.tsx`、`BookEditForm.tsx`、`BookCoverField.tsx`、`SuggestionField.tsx`、`ReadingDateFields.tsx`、`RatingField.tsx`、`TypePicker.tsx`、`TagPicker.tsx`、`src/app/book/new.tsx`、`src/app/book/[id]/edit.tsx`；扩展 `tests/books/addBook.test.tsx`、`BookEditForm.test.tsx`、`ReadingDateFields.test.tsx`。

**Interfaces：** `AddBookForm` 和 `BookEditForm` 保留现有 props、`normalizeBookCreate`/`normalizeBookEdit`、`onSave` 和 `BookCoverField` 的 `onChange(value, removed)`；只重排渲染。封面与书名在顶部，基本信息组为作者、首发平台、主角；阅读信息组由状态决定，分类标签组容纳快捷标签与全部标签入口。

- [ ] **步骤 1：写失败测试。** 新增页顶部先能找到封面和书名；作者、首发平台、默认两个主角输入位在同一基本信息组；点击“添加主角”后第三个字段可输入；没有“低频内容”；只填书名可保存；相册/链接/移除封面入口可达。想读理由、日期和半星评分只按现有状态规则出现；编辑已有理由/评分仍可达。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/addBook.test.tsx tests/books/BookEditForm.test.tsx tests/books/ReadingDateFields.test.tsx`；预期字段顺序或分组断言失败。
- [ ] **步骤 3：重排表单。** 复用 `GroupedSection`；保持建议输入、日期滚轮、标签选择、封面暂存/下载、校验和状态转换的现有实现。调整键盘滚动及底部留白，使第三个主角字段和保存按钮可达；不要新增仓储写入路径。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2，预期通过；提交 `refactor: group book entry forms`。

### 任务 4：详情、阅读记录与摘记图片

**文件：** 修改 `src/books/BookDetail.tsx`、`ReadingHistoryForm.tsx`、`NoteForm.tsx`、`NotesSection.tsx`、`HighlightsSection.tsx`、`ImagePreview.tsx`、`src/app/book/[id].tsx`、`src/app/book/[id]/reading/[sessionId].tsx`；扩展 `tests/books/BookDetail.test.tsx`、`NotesSection.test.tsx`、`HighlightsSection.test.tsx`、`NoteForm.test.tsx`、`bookRoutes.test.tsx`。

**Interfaces：** 详情继续接收现有 `book/sessions/onEditReading`，路由保留 `focusImageId/focusNoteId` 参数及现有仓储调用。记录、摘记、精彩片段默认渲染展开；共用区段仅改变外观，不改保存或自动关联规则。

- [ ] **步骤 1：写失败测试。** 封面/书名/作者/状态/评分组成顶部信息层；阅读历史、摘记、精彩片段不经二次点击即可见；补记首刷、编辑阅读、添加摘记/图片、搜索定位与删除确认入口保留。长标题可换行；图片识别失败/重试及空列表仍可理解。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/BookDetail.test.tsx tests/books/NotesSection.test.tsx tests/books/HighlightsSection.test.tsx tests/books/NoteForm.test.tsx tests/books/bookRoutes.test.tsx`；预期新层级断言失败。
- [ ] **步骤 3：实现页面呈现。** 详情头部和下方区段统一间距，必要操作就近显示；日期页、摘记输入、图片预览及在读快捷面板统一安全区与键盘处理，不引入折叠内容或新的阅读记录类型。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2，预期通过；提交 `refactor: refresh book detail and records`。

### 任务 5：回顾与分享页面外壳

**文件：** 修改 `src/app/(tabs)/recap.tsx`、`src/app/settings/overview.tsx`、`annual-recap.tsx`、`annual-summary.tsx`、`themed-recap.tsx`、`recap-share.tsx`；扩展 `tests/books/libraryOverviewPage.test.tsx`、`annualRecapPage.test.tsx`、`annualSummaryPage.test.tsx`、`themedRecapPage.test.tsx`、`recapSharePage.test.tsx`。

**Interfaces：** 回顾页继续使用现有统计仓储、年份参数、故事页、海报和分享服务；只改变页面标题、入口分组、卡片外壳和按钮反馈。生成的分享图内容不受本任务改写。

- [ ] **步骤 1：写失败测试。** 回顾首页可见书库概览、年度总结、年度阅读回顾和主题回顾入口；空书库仍可添加或导入；年份切换、分享预览、失败重试与返回路径仍可达。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/libraryOverviewPage.test.tsx tests/books/annualRecapPage.test.tsx tests/books/annualSummaryPage.test.tsx tests/books/themedRecapPage.test.tsx tests/books/recapSharePage.test.tsx`；预期页面呈现断言失败。
- [ ] **步骤 3：实现回顾外观。** 使用 `TabPageHeader`、`GroupedSection` 和现有主题色整理首页；子页面统一导航、按钮与加载状态。不要修改统计去重、快照内容或图片导出格式。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2，预期通过；提交 `refactor: align recap screens with app UI`。

### 任务 6：管理首页、主题与标签

**文件：** 修改 `src/app/(tabs)/manage.tsx`、`src/app/settings/data.tsx`、`tags.tsx`、`appearance.tsx`、`data-safety.tsx`、`src/theme/ThemePicker.tsx`；扩展 `tests/dataSafety/ManageTab.test.tsx`、`DataSafetyPage.test.tsx`、`tests/theme/ThemePicker.test.tsx`、`tests/navigation/appearance.test.tsx`。

**Interfaces：** 管理页用 `ActionRow` 保留既有目的路由；备份提醒继续使用 `BackupReminderCard` 和原偏好存储；主题选择继续调用 `setTheme(id)`，不改变 `THEME_IDS` 或存储键。

- [ ] **步骤 1：写失败测试。** 管理首页全部原有入口可达，备份提醒按现有条件显示；八套主题名称与选中标识保留；标签管理可新增/选择/调整快捷标签；数据安全说明可访问；书库概览只显示同一份数据，不复制统计实现。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/dataSafety/ManageTab.test.tsx tests/dataSafety/DataSafetyPage.test.tsx tests/theme/ThemePicker.test.tsx tests/navigation/appearance.test.tsx`；预期分组或入口断言失败。
- [ ] **步骤 3：实现管理外观。** 分组列表替代堆叠大按钮，使用标题、简短说明与箭头；主题选择页保留预览与保存反馈。保留旧页面路径供已有导航使用，不增设重复页面。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2，预期通过；提交 `refactor: organize management and appearance screens`。

### 任务 7：导入、导出与备份页面

**文件：** 修改 `src/app/settings/import.tsx`、`export.tsx`、`backup.tsx`，以及 `src/import/ImportSourceForm.tsx`、`ScreenshotImportSource.tsx`、`TableImportSource.tsx`、`TableImportMappingView.tsx`、`ImportReviewList.tsx`、`ImportCompletionView.tsx`；扩展 `tests/import/importPage.test.tsx`、`tableImportPage.test.tsx`、`screenshotImportSource.test.tsx`、`ImportCompletionView.test.tsx`、`tests/export/openExportPage.test.tsx`、`tests/backup/backupPage.test.tsx`。

**Interfaces：** 页面继续调用现有导入解析、预览、提交、导出与备份服务；所有来源、候选操作、确认和错误状态保留。`GroupedSection` 与 `ActionRow` 只负责视觉容器，不参与数据写入。

- [ ] **步骤 1：写失败测试。** 文字/TXT、表格、截图三个导入入口及预览/重复项决定都可操作；长列表仍可滚动到确认；导入完成页统计可见。导出/备份/恢复的加载、错误、取消和危险确认保持原调用路径；不能因重排跳过确认。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/import/importPage.test.tsx tests/import/tableImportPage.test.tsx tests/import/screenshotImportSource.test.tsx tests/import/ImportCompletionView.test.tsx tests/export/openExportPage.test.tsx tests/backup/backupPage.test.tsx`；预期新布局断言失败。
- [ ] **步骤 3：实现数据页外观。** 把来源选择、步骤说明、预览与操作按钮整理成分组；确保底部操作可达、键盘和面板不挡内容。业务服务和文件格式保持原样。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2，预期通过；提交 `refactor: align data workflows with app UI`。

### 任务 8：全应用回归与发布候选验收

**文件：** 仅修复任务 1–7 暴露的 UI 回归及对应测试；另在计划执行记录中写明真机/发布检查结果，不创建新的业务功能。

**Interfaces：** 现有路由、仓储与备份文件继续互通；统一主题令牌覆盖所有已触及页面。发布候选状态按“自动化、真机、生产构建、商店资料”分别记录，不以其中一项代替其他项。

- [ ] **步骤 1：静态检查。** 运行 `npx.cmd tsc --noEmit`、`npm.cmd run lint`、`git diff --check`；预期全部退出码为 0。
- [ ] **步骤 2：一次完整自动化回归。** 运行 `npm.cmd test -- --runInBand`；预期全部通过。若有失败，先判断是否由本轮 UI 变化导致，只修复确认的回归后重跑失败组及完整回归。
- [ ] **步骤 3：真机验收。** 在 iPhone 上逐条检查三栏、八主题代表样本、窄屏/大字号、键盘下第三个主角、封面选择/链接、五状态/搜索/筛选/批量/快捷记录、详情默认展开、回顾分享、三类导入与备份确认；检查已声明支持的 iPad 布局。逐项记录实际通过、失败或未测试。
- [ ] **步骤 4：发布准备核对。** 核对生产构建配置、签名/Apple Developer 账号、App Store Connect 截图文案与隐私资料是否齐备；尚未完成的项目明确列为上架阻碍。UI 验收通过只表示可以进入发布流程，不声称已经获 Apple 审核。
- [ ] **步骤 5：提交与交付。** 仅对任务 8 的实际修复提交 `fix: polish UI release candidate`；若无修复则不造空提交。交付变更摘要、自动化结果、真机结果及剩余发布阻碍；按用户后续指示合并与上传。
