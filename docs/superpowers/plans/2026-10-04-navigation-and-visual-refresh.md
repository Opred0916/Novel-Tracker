# 底部导航与视觉改版 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task, or `superpowers:subagent-driven-development` if the user explicitly chooses delegation. Steps use checkbox (`- [ ]`) syntax for tracking. Read the spec first.

**Goal / 目标：** 将现有书架整理为“书架／回顾／管理”三栏，提供 8 套可持久化主题，并重绘无图片小说的默认封面，不改变已有书籍数据和功能语义。

**Architecture / 架构：** Expo Router 的 `(tabs)` 路由组承载三个首页，小说详情及编辑等继续由根 Stack 承载；旧入口保留轻量重定向。独立主题模块保存设备偏好并向页面提供统一令牌；默认封面使用稳定书籍 ID 选择本地纸色，不依赖主题或网络。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router JavaScript Tabs、React Native、TypeScript、`expo-sqlite/kv-store`、现有 Jest；Windows 命令使用 `npm.cmd`／`npx.cmd`。不新增依赖。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-04-navigation-and-visual-refresh-design.md`

## Global Constraints / 全局约束

- 底部栏仅有 `书架`、`回顾`、`管理`，始终显示图标和文字；当前功能、记录、导入导出、备份和阅读规则不变。
- 维持浅色界面；默认主题 `墨绿`，共 8 个预设。底色 `#F6F3EC`、卡片白色、正文 `#292D29`；评分暖金和错误／删除暗红不随主题改变。
- 主题是当前设备偏好，不进入书库备份或开放格式导出；更换主题不得修改小说、原始封面图片或数据库业务记录。
- 默认封面保留书名、最多三行、移除 `NOVEL TRACKER`；颜色由稳定书籍 ID 决定且独立于主题。真实图片封面保持原样。
- 窄屏五个状态横向单行；新增按钮不能挡住最后书卡、底部栏或 iPhone 安全区。切换栏目保留当前书架搜索／筛选草稿。
- 开发只运行改动相关的定向测试，收尾一次 TypeScript／lint 与差异检查；iPhone Expo Go 真机由用户验收，未实测不声称通过。

## Review Focus

- 旧的 `/settings/overview`、`/settings/data` 链接和返回路径：应进入对应新栏目或明确子页面，不能出现空白或循环返回；任务 2 测试。
- 书架切换栏目时仍有搜索、防抖请求或批量选择：保留搜索／筛选，离开书架取消批量模式且不误选旧结果；任务 3 测试。
- 首次安装、无效偏好值、设备存储写入失败：显示墨绿默认值；失败时不谎称已保存，书库照常可用；任务 1 测试。
- 小屏、打开键盘、最后一张书卡与底部安全区：状态不换行，按钮和卡片可达；任务 3 页面测试及真机验收。
- 无封面长标题、同名不同书、已有远程或本地图片：默认封面稳定截断、正文仍完整；图片不被替换；任务 4 测试。

---

## 文件分工

- 新建 `src/theme/theme.ts`（主题 ID、8 套色板、固定语义色）、`src/theme/ThemeProvider.tsx`（本地偏好读写及 hook）、`src/theme/ThemePicker.tsx`（8 张选择卡）；新增 `tests/theme/theme.test.ts`、`tests/theme/ThemeProvider.test.tsx`、`tests/theme/ThemePicker.test.tsx`。
- 新建 `src/app/(tabs)/_layout.tsx`、`src/app/(tabs)/index.tsx`、`src/app/(tabs)/recap.tsx`、`src/app/(tabs)/manage.tsx` 与 `src/books/BookshelfScreen.tsx`；修改 `src/app/_layout.tsx`，删除迁移完的 `src/app/index.tsx`（新 tab index 继续占据 `/`），`src/app/settings/overview.tsx`、`src/app/settings/data.tsx` 保留为重定向。调整 `tests/books/bookRoutes.test.tsx`、`tests/books/annualRecapPage.test.tsx`，新建 `tests/navigation/tabs.test.tsx`。
- 新建 `src/books/BookshelfToolbar.tsx` 负责状态条、搜索、筛选与排序入口；修改 `src/books/BookshelfScreen.tsx`、`src/books/BookCard.tsx`。书架路由只渲染 `BookshelfScreen`，不复制业务状态。扩展 `tests/books/bookRoutes.test.tsx`、`tests/books/useBookSearch.test.tsx`。
- 修改 `src/books/BookCover.tsx` 与其调用者 `BookCard.tsx`、`BookDetail.tsx`、`BookCoverField.tsx`、`src/app/settings/annual-recap.tsx`；新建 `src/books/defaultCover.ts`、`tests/books/defaultCover.test.ts`、`tests/books/BookCover.test.tsx`。
- 将现有 UI 硬编码紫色按页面责任逐步迁移到主题令牌：`src/books/{AddBookForm,BookEditForm,BookCoverField,BookDetail,BulkOrganizePanel,HighlightsSection,ImagePreview,NoteForm,NotesSection,RatingField,ReadingDateFields,ReadingHistoryForm,TagPicker,TypePicker}.tsx`；`src/import/{ImportReviewList,ImportSourceForm,ScreenshotImportSource,TableImportMappingView,TableImportSource}.tsx`；`src/app/book/[id].tsx`、`src/app/book/[id]/edit.tsx`、`src/app/book/[id]/reading/[sessionId].tsx`、`src/app/settings/{annual-recap,backup,export,import,overview,tags}.tsx`。`src/storage/AppProvider.tsx` 只在确实显示主题相关 UI 时修改；`src/books/bookCoverFiles.ts`、`src/books/sqliteRepository.ts` 中与封面业务状态有关的颜色不得被误改。

### 任务 1：主题令牌与设备偏好

**文件：** 新建 `src/theme/theme.ts`、`src/theme/ThemeProvider.tsx`、`src/theme/ThemePicker.tsx` 和对应三个测试；修改 `src/app/_layout.tsx` 接入 Provider。

**Interfaces：** `ThemeId = 'forest' | 'mist' | 'clay' | 'pomegranate' | 'olive' | 'graphite' | 'ocean' | 'amber'`；`ThemePalette = { id: ThemeId; name: string; primary: string; primarySoft: string; primaryPressed: string; background: string; card: string; text: string; border: string; mutedText: string; rating: string; danger: string }`；`THEMES: Record<ThemeId, ThemePalette>`；`useTheme(): { theme: ThemePalette; themeId: ThemeId; setTheme(id: ThemeId): Promise<void>; saveError: string | null }`。`primaryPressed` 将主色各 RGB 通道乘以 `0.85` 并四舍五入生成；固定色独立于主题。

- [ ] **步骤 1：写失败测试。** 8 个 ID 与设计文档名称、主色、浅色一一对应；默认 `forest/#28584E`，固定底色 `#F6F3EC`。新设备和未知旧值均回退墨绿；有效值重载后仍选中；存储写失败时保留上次已保存主题并暴露错误。8 张预览卡显示名称、选中标记，按下后即时预览并尝试保存。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/theme`；预期新模块或断言失败。
- [ ] **步骤 3：实现模块。** `expo-sqlite/kv-store` 使用键 `novel-tracker.theme.v1`；ThemeProvider 在读取期间先显示墨绿且不阻塞书库，选择成功后更新持久状态，失败时还原并提示。根布局用 Provider 为 Stack 提供背景和标题样式，不改业务库 schema。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2，预期通过；提交 `feat: add persistent theme presets`。

### 任务 2：三栏导航与页面归属

**文件：** 新建四个 `(tabs)` 路由文件和 `src/books/BookshelfScreen.tsx`；修改根布局与两个旧设置路由，删除旧书架路由；修改 `tests/navigation/tabs.test.tsx`、`tests/books/bookRoutes.test.tsx`、`tests/books/annualRecapPage.test.tsx`。

**Interfaces：** `src/app/(tabs)/index.tsx` 渲染 `BookshelfScreen`，继续响应 `/`；`recap.tsx` 承载现有书库概览与年度回顾入口；`manage.tsx` 分组链接快捷标签、旧记录导入、备份恢复、开放导出、`ThemePicker`。旧 `/settings/overview`、`/settings/data` 使用 Expo Router `Redirect` 转到 `/recap`、`/manage`；小说详情、编辑、阅读日期和现有管理子页面仍在根 Stack。

- [ ] **步骤 1：写失败测试。** 三栏图标文字和选中态存在；点回顾能看原概览及年度入口，点管理能看所有工具与主题；旧路径重定向且子页面返回相应栏目。空书库的回顾页提供添加或导入入口。备份恢复确认流程仍调用原页面而非新实现。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/navigation/tabs.test.tsx tests/books/bookRoutes.test.tsx tests/books/annualRecapPage.test.tsx`；预期新路由／入口断言失败。
- [ ] **步骤 3：实现路由。** Tabs 只放三个首页，图标用已有 `@expo/vector-icons`；路由组名不改变对外 `/recap`、`/manage` URL。先把原 `src/app/index.tsx` 内容原样移入 `BookshelfScreen` 并更新导入路径，不在本任务重做其布局；新书架路由只做包装。将概览／数据管理页面内容迁至新首页，旧文件仅重定向；保留子页面 Stack 标题和可返回路径。移走书架重复工具入口。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2，预期通过；提交 `feat: organize app into three tabs`。

### 任务 3：书架首屏与工具栏

**文件：** 新建 `src/books/BookshelfToolbar.tsx`；修改 `src/books/BookshelfScreen.tsx`、`src/books/BookCard.tsx` 和书架路由／搜索测试。

**Interfaces：** `BookshelfScreen` 持有原书架查询、排序、筛选和批量选择状态；`BookshelfToolbar` 从 props 接收五种状态及计数、搜索值、排序标题、有效筛选数和回调，不自己访问仓储。回到书架时搜索／筛选沿用同一页面状态；离开书架取消批量选择，防抖查询遵守原 `resultsCurrent` 语义。

- [ ] **步骤 1：写失败测试。** 320px 宽状态条仍单行且可水平滚动；只有有效筛选时显示计数与清除；排序／筛选按钮、批量整理入口可点击；新增按钮与最后一张卡之间留出可滚动空间。切栏目再返回保留搜索／筛选，批量选择已取消；快速查询仍不把旧结果当新结果。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/bookRoutes.test.tsx tests/books/useBookSearch.test.tsx`；预期布局或状态断言失败。
- [ ] **步骤 3：实现布局。** 缩小宣传语，顺序固定为标题、单行状态、搜索、工具栏、列表；搜索可读，状态的选中有文字／图形标识。新增按钮置于底部栏上方，使用安全区尺寸设置列表底部留白；书卡保持封面、标题、作者、评分层级，不再涂大块主题色。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2，预期通过；提交 `feat: simplify bookshelf layout`。

### 任务 4：默认书名封面

**文件：** 新建 `src/books/defaultCover.ts`、`tests/books/defaultCover.test.ts`、`tests/books/BookCover.test.tsx`；修改 `BookCover.tsx` 与文件分工列出的四个调用者。

**Interfaces：** `getDefaultCoverStyle(bookId: string): { backgroundColor: string; accentColor: string }` 对稳定 ID 做确定性哈希，并在不少于 4 组低饱和纸色中选一组；`BookCover` 新增可选 `bookId?: string`，无 ID 的添加预览使用固定纸色，已有书卡／详情／年度回顾传稳定 ID。图片 URI 存在时仍只显示原图。

- [ ] **步骤 1：写失败测试。** 相同 ID 跨渲染得到同色，不同 ID 可以分布多种纸色；默认封面书名最多三行且无英文品牌字样；长名在小书卡中截断但书卡正文仍完整。图片 URI 存在时不绘制文字封面，切换主题不改变默认封面色。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/books/defaultCover.test.ts tests/books/BookCover.test.tsx`；预期新函数／展示断言失败。
- [ ] **步骤 3：实现封面。** 用本地 View/Text 和细线装饰，不访问网络或改封面文件；现有书籍 ID 只做配色键。添加新书尚无 ID 时使用固定预览，保存后即改为书籍 ID 对应色。
- [ ] **步骤 4：绿灯并提交。** 重跑步骤 2，预期通过；提交 `feat: draw readable default book covers`。

### 任务 5：其余页面统一主题并验证

**文件：** 修改文件分工列出的表单、详情、日期、摘记、导入和管理页面；扩展现有相关页面测试与 `tests/theme/ThemePicker.test.tsx`；必要时更新 `README.md` 的导航说明。

**Interfaces：** 所有交互组件使用任务 1 的 `useTheme()`；评分读取固定 `rating`，危险操作读取固定 `danger`，不把语义色覆盖为 `primary`。保留原 props、存储及验证语义。

- [ ] **步骤 1：写失败测试。** 在墨绿及另一主题下检查按钮、链接、选中态、日期操作、标签和导入预览取当前令牌；评分仍暖金、错误仍暗红；切换主题不影响小说内容、备份／导出数据和真实封面。管理页当前主题有文字或勾选标记。
- [ ] **步骤 2：运行红灯。** `npm.cmd test -- --runInBand tests/theme tests/books/annualRecapPage.test.tsx tests/books/bookRoutes.test.tsx`（按实际新增的定向测试补齐路径）；预期旧硬编码颜色断言失败。
- [ ] **步骤 3：迁移颜色。** 按页面和组件责任替换运行时 UI 紫色，不机械替换业务／图片相关常量；统一边框、禁用、对比度与按压态。使用 `rg -n '#593f72|#63447d|#8b6aa4|#80659d|#eee5f4|#f3edf7' src` 核对残留，必要的历史非 UI 值注明理由。
- [ ] **步骤 4：最终验证。** 跑上述定向测试、`npx.cmd tsc --noEmit`、`npm.cmd run lint`、`git diff --check`，均须成功；检查 8 主题主色白字和浅底选中文字对比度。给用户提供 iPhone Expo Go 验收清单：窄屏状态、键盘、底部安全区、三栏与子页返回、主题重启保持、默认／真实封面。
- [ ] **步骤 5：提交。** 提交 `feat: apply themes across novel tracker`；未获明确授权不合并或推送。
