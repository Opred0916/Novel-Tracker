# 回顾卡片保存与分享 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the spec first. Only delegate if the user explicitly chooses that execution method.

**Goal / 目标：** 把现有三个年度主题中的任意一个制作成可预览的 PNG，允许用户主动保存到 iPhone 相册或打开系统分享面板。

**Architecture / 架构：** 从现有 `ThemedRecap` 创建不含私人摘记的固定快照，同一个卡片组件同时用于屏幕预览和 PNG 截图。独立平台模块负责截图、相册写入、系统分享和临时文件清理；页面负责加载、就绪状态与防重复操作，不改现有统计仓储。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native、TypeScript、`react-native-view-shot`、`expo-media-library`、现有 `expo-sharing`／`expo-file-system`、Jest。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-04-recap-card-image-sharing-design.md`。

## Global Constraints / 全局约束

- 一张图片只对应一个年份和一个主题：`rereadSuccess`、`fiveStar` 或 `dropped`。数据沿用现有仓储口径和按书名、稳定 ID 的顺序；不增加数据库表或网络请求。
- 卡片最多展示前 **6 本**及“另有 N 本”，总数是主题的真实书籍数；每本使用本主题最近一条符合条件的真实 `endedOn`。五星文案必须写“当前总体评分 5 星”。
- 图片不包含摘记正文、原始截图、导入来源、设备信息、系统状态栏和页面按钮。封面失败时使用带书名的默认封面；预览与 PNG 使用同一组件和冻结的数据／配色。
- 保存到相册与系统分享是两个独立操作。只有保存请求相册写入权限；只有媒体库写入成功才提示“已保存”。分享面板打开不等于发送成功，取消属于正常退出。
- 当前项目使用 Expo SDK 57；用 `npx.cmd expo install react-native-view-shot expo-media-library` 安装匹配版本。媒体库使用 `requestPermissionsAsync(true, ['photo'])` 与 `Asset.create(uri)`，不得从主入口调用已弃用且运行时不可用的 `saveToLibraryAsync`。
- 只承诺 iPhone Expo Go 的本轮人工验收；独立安装版的权限配置与 Android 行为另行验收。Windows 命令使用 `npm.cmd`／`npx.cmd`。

## Review Focus

- 同名书但不同 ID、跨主题的同一本书：每张图片只列当前主题的真实条目，不串主题；任务 1 的快照测试。
- 超过 6 本与多次符合条件的会话：总数和剩余数准确，每本日期取最近一次；任务 1 的快照测试。
- 封面缺失或加载失败、长书名：预览能退回默认封面并结束就绪等待，截图不含空白封面；任务 2 的组件测试。
- 相册权限拒绝、分享不可用、用户取消分享：状态文案与真正的操作结果一致，失败不影响另一操作；任务 3 的平台及页面测试。
- 年份快速切换、返回、连续点击：旧查询和旧图片不能覆盖新预览，也不重复打开系统面板；任务 3 的页面测试。

---

## 文件分工

- 新建 `src/books/recapShareSnapshot.ts`、`tests/books/recapShareSnapshot.test.ts`：从现有主题结果构建可冻结的展示快照。
- 新建 `src/books/RecapShareCard.tsx`、`tests/books/RecapShareCard.test.tsx`：固定宽度的竖版卡片、真实封面／默认封面、加载就绪信号；组件根视图供截图复用。
- 新建 `src/books/recapSharePlatform.ts`、`tests/books/recapSharePlatform.test.ts`：临时 PNG 截图、相册写入、系统分享和尽力清理。
- 新建 `src/app/settings/recap-share.tsx`、`tests/books/recapSharePage.test.tsx`；修改 `src/app/settings/themed-recap.tsx`、`src/app/_layout.tsx`、`tests/books/themedRecapPage.test.tsx`、`README.md`：入口、预览、动作状态与使用说明。
- 修改 `package.json`、`package-lock.json`：仅增加 Expo SDK 57 兼容的截图与媒体库依赖。

### Task 1：分享内容快照

**Files:** Create `src/books/recapShareSnapshot.ts`, `tests/books/recapShareSnapshot.test.ts`.

**Interfaces:** `type RecapShareThemeId = 'rereadSuccess' | 'fiveStar' | 'dropped'`；`type RecapShareSnapshot = { year: number; themeId: RecapShareThemeId; title: string; description: string; totalBooks: number; overflowCount: number; books: { bookId: string; title: string; coverUri: string | null; endedOn: string }[]; colors: Pick<ThemePalette, 'primary' | 'primarySoft' | 'background' | 'card' | 'text' | 'mutedText' | 'border'> }`。`makeRecapShareSnapshot(recap: ThemedRecap, themeId: RecapShareThemeId, palette: ThemePalette): RecapShareSnapshot | null`；空主题返回 `null`，按 `books` 原顺序取前 6 本，每本取该主题 `sessions[0].endedOn`。返回新数组和颜色值，不持有可变的仓储对象。

- [ ] **Step 1: Write the failing tests.** 用现有 `ThemedRecap` 类型构造三个主题，断言主题与数量、日期、顺序及隐私字段：

  ```ts
  expect(snapshot?.books.map(book => book.bookId)).toEqual(['same-title-a', 'same-title-b']);
  expect(snapshot?.books[0].endedOn).toBe('2026-09-12');
  expect(snapshot?.description).toContain('当前总体评分 5 星');
  expect(makeRecapShareSnapshot(emptyRecap, 'dropped', palette)).toBeNull();
  expect(sevenBookSnapshot?.overflowCount).toBe(1);
  expect(sevenBookSnapshot?.books).toHaveLength(6);
  expect(JSON.stringify(snapshot)).not.toContain('私人摘记正文');
  ```

- [ ] **Step 2: Run red.** `npm.cmd test -- --runInBand tests/books/recapShareSnapshot.test.ts`；预期新模块缺失。
- [ ] **Step 3: Implement.** 在 `src/books/recapShareSnapshot.ts` 实现上述签名；三个主题的标题和说明用固定中文文案，五星说明保留“当前总体评分 5 星”；不展开其它主题会话或摘记。
- [ ] **Step 4: Run green.** 重跑步骤 2，预期该文件测试通过。
- [ ] **Step 5: Commit.** 仅提交本任务的源文件和测试，提交信息 `feat: prepare recap share snapshots`。

### Task 2：预览与可截图卡片

**Files:** Create `src/books/RecapShareCard.tsx`, `tests/books/RecapShareCard.test.tsx`; modify `src/books/BookCover.tsx` only if a small optional image-ready callback can reuse its fallback behavior. Otherwise reuse `getDefaultCoverStyle` inside the new component.

**Interfaces:** `RecapShareCard = forwardRef<View, { snapshot: RecapShareSnapshot; onReady(ready: boolean): void }>`。根 `View` 设置 `collapsable={false}`，固定逻辑宽度 360dp、高度至少 560dp，超过最小高度后按书数自然增长，作为 `captureRef` 目标。真实封面仅在加载结束后计入就绪；图片错误时改画带书名的默认封面并计入就绪；没有图片的书立即计入就绪。换 `snapshot` 时重新等待本次图片。

- [ ] **Step 1: Write the failing component tests.** `renders_only_share_content`、`falls_back_on_cover_error_and_then_marks_ready`、`waits_for_all_real_covers` 断言：

  ```ts
  expect(screen.getByText('2026 年')).toBeTruthy();
  expect(screen.getByText('另有 1 本')).toBeTruthy();
  expect(screen.queryByText('分享前请确认')).toBeNull();
  expect(screen.getByLabelText('无封面书默认封面')).toBeTruthy();
  expect(onReady).not.toHaveBeenCalledWith(true); // 最后一张真实封面尚未完成
  // 对最后一张封面触发 onError 后，显示默认封面且 onReady(true) 只对应当前快照；旧快照的迟到事件不解锁新快照。
  ```
- [ ] **Step 2: Run red.** `npm.cmd test -- --runInBand tests/books/RecapShareCard.test.tsx`；预期组件缺失。
- [ ] **Step 3: Implement.** 卡片只渲染导出内容，不渲染操作按钮与系统信息。用同一 `snapshot` 生成屏幕预览和截图；长书名最多三行但卡片列表逐书可辨。封面加载完成或失败后的回退状态都通知 `onReady`。
- [ ] **Step 4: Run green.** 重跑步骤 2，预期组件测试通过。
- [ ] **Step 5: Commit.** 仅提交本任务变更，提交信息 `feat: render recap share card`。

### Task 3：本地 PNG、相册与系统分享

**Files:** Create `src/books/recapSharePlatform.ts`, `tests/books/recapSharePlatform.test.ts`; modify `package.json`, `package-lock.json`.

**Interfaces:** `captureRecapPng(view: View): Promise<string>` 调用 `captureRef(view, { format: 'png', result: 'tmpfile', quality: 1 })`；`saveRecapPng(uri: string): Promise<void>` 先请求只写相册权限再调用 `Asset.create(uri)`；`shareRecapPng(uri: string): Promise<void>` 检查分享可用并以 `image/png`、`public.png` 打开 `Sharing.shareAsync`；`discardRecapPng(uri: string): void` 用 `new File(uri).delete()` 尽力清理，清理错误不覆盖保存／分享结果。`RecapSharePlatformError` 的 `code` 为 `'permission_denied' | 'unavailable' | 'failed'`，页面据此显示提示。

- [ ] **Step 1: Write the failing platform tests.** `captures_local_png`、`writes_asset_after_grant`、`denied_permission_does_not_save`、`opens_share_sheet_for_png`、`unavailable_share_does_not_open_sheet`、`cleanup_failure_is_nonfatal` 断言：

  ```ts
  expect(await captureRecapPng(view)).toBe('file:///cache/recap.png');
  await saveRecapPng('file:///cache/recap.png'); // 权限获批
  expect(Asset.create).toHaveBeenCalledWith('file:///cache/recap.png');
  await expect(saveRecapPng('file:///cache/recap.png')).rejects.toMatchObject({ code: 'permission_denied' });
  expect(Asset.create).not.toHaveBeenCalled();
  await shareRecapPng('file:///cache/recap.png'); // 分享可用
  expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/recap.png', expect.objectContaining({ UTI: 'public.png' }));
  await expect(shareRecapPng('file:///cache/recap.png')).rejects.toMatchObject({ code: 'unavailable' });
  expect(Sharing.shareAsync).not.toHaveBeenCalled();
  expect(() => discardRecapPng('file:///cache/recap.png')).not.toThrow();
  ```
- [ ] **Step 2: Run red.** `npm.cmd test -- --runInBand tests/books/recapSharePlatform.test.ts`；预期新模块缺失。
- [ ] **Step 3: Install dependencies.** `npx.cmd expo install react-native-view-shot expo-media-library`；确认安装的是 SDK 57 兼容版本，并核对 `package-lock.json`。不得直接使用旧版 `saveToLibraryAsync`。
- [ ] **Step 4: Implement.** 在平台模块实现接口；把原生接口与页面分离以便测试。仅当用户点击动作时截图和请求相应能力；保存和分享完成后由页面 `finally` 调用 `discardRecapPng`。
- [ ] **Step 5: Run green.** 重跑步骤 2，预期平台测试通过；`npx.cmd expo-doctor` 预期依赖检查通过。
- [ ] **Step 6: Commit.** 提交源文件、测试和依赖文件，提交信息 `feat: save and share recap png`。

### Task 4：路由、状态与 iPhone 验收入口

**Files:** Create `src/app/settings/recap-share.tsx`, `tests/books/recapSharePage.test.tsx`; modify `src/app/settings/themed-recap.tsx`, `src/app/_layout.tsx`, `tests/books/themedRecapPage.test.tsx`, `README.md`.

**Interfaces:** 主题页仅对非空主题显示“制作图片”，导航参数 `{ year: String(recap.year), theme: RecapShareThemeId }` 到 `/settings/recap-share`。预览页验证年份为 1～9999 的四位整数、主题为三种枚举之一；调用现有 `useThemedRecapRepository().getYear(year)`，再调用任务 1 的 `makeRecapShareSnapshot` 并保留至页面关闭。页面持有 `ref<View>` 指向任务 2 卡片；保存或分享时调用任务 3 的 `captureRecapPng` 和对应动作，最后清理。单次运行由同步 `busyRef` 锁定，只有 `onReady(true)` 后按钮可用；请求序号阻止旧查询回写。

- [ ] **Step 1: Write the failing page tests.** `opens_only_nonempty_theme`、`rejects_invalid_or_stale_preview`、`waits_for_card_and_blocks_double_taps`、`shows_save_result_without_claiming_share_success` 断言：

  ```ts
  expect(screen.queryByLabelText('制作弃读书图片')).toBeNull(); // 空主题
  expect(router.push).toHaveBeenCalledWith({ pathname: '/settings/recap-share', params: { year: '2026', theme: 'fiveStar' } });
  expect(screen.getByLabelText('保存到相册')).toBeDisabled(); // 封面未就绪
  expect(captureRecapPng).toHaveBeenCalledTimes(1); // 连续点击
  expect(screen.queryByText('发送成功')).toBeNull();
  ```

  测试分别设置有效路由参数、拒绝权限、仓储延迟响应和返回动作；断言保存失败后分享按钮仍可用，旧年份结果不覆盖新预览。
- [ ] **Step 2: Run red.** `npm.cmd test -- --runInBand tests/books/recapSharePage.test.tsx tests/books/themedRecapPage.test.tsx`；预期新路由或入口断言失败。
- [ ] **Step 3: Implement.** 添加路由和预览状态，按钮外显示“图片包含你的书名与封面，分享前请确认”；成功文案仅按平台结果设置，错误可重试。不要把全书库或摘记放进路由参数；保持原主题列表、空态和详情导航。
- [ ] **Step 4: Run green.** 重跑步骤 2，再运行 `npm.cmd test -- --runInBand tests/books/recapShareSnapshot.test.ts tests/books/RecapShareCard.test.tsx tests/books/recapSharePlatform.test.ts tests/books/recapSharePage.test.tsx tests/books/themedRecapPage.test.tsx`；全部通过。
- [ ] **Step 5: Verify and document.** 运行 `npx.cmd tsc --noEmit`、`npx.cmd expo lint --no-cache`、`npx.cmd expo-doctor`、`git diff --check`；更新 README 的入口、权限与 iPhone Expo Go 检查步骤。真机检查三主题、超过 6 本时整张 PNG 不被屏幕裁切、相册权限拒绝、系统面板取消和分享结果；没有实际手机反馈时标记“待实机验收”。
- [ ] **Step 6: Commit.** 提交页面、测试与 README，提交信息 `feat: expose recap image preview`。
