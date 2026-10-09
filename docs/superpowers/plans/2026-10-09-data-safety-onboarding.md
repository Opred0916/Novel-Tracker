# 首次使用与数据安全引导 Implementation Plan

> **For agentic workers / 供执行者阅读：** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the spec first.

**Goal / 目标：** 用一次性、非阻塞的引导提醒用户妥善保存书库备份，并提供从 Expo Go 迁移到独立版的常驻说明。

**Architecture / 架构：** 用现有 Expo SQLite 键值存储记录两个相互独立的本机已处理标记；书架与管理页分别依据现有书库／备份概览决定是否显示轻量卡片。新增静态帮助路由并链接现有备份页，不改备份服务和数据格式。

**Tech Stack / 技术栈：** Expo SDK 57、Expo Router、React Native 0.86、TypeScript、`expo-sqlite/kv-store`、Jest、Testing Library；不新增依赖。Windows PowerShell 使用 `npm.cmd`／`npx.cmd`。

**Spec / 设计文档：** `docs/superpowers/specs/2026-10-09-data-safety-onboarding-design.md`

## Global Constraints / 全局约束

- 首次说明只在真实空书库的“全部”分区自动显示一次，不挡住“添加小说”；已有书库和搜索／筛选空结果不显示。
- 备份提醒只在“管理”页、书库至少一本且 `lastGeneratedAt === null` 时显示一次；无重复弹窗、系统通知或定时任务。
- 两个已处理标记只在用户点击对应操作时写入，互不影响；读取失败时不显示自动提示，但常驻帮助入口仍可用。
- `lastGeneratedAt` 只表示应用生成过备份，不能声称外部文件已保存；迁移说明必须要求用户确认 `.noveltracker` 文件在“文件”等位置可找到。
- 恢复仍是完整替换；帮助页必须提醒独立版已有新记录时先备份，并在迁移后核对数据。
- 不新增 SQLite 表或迁移，不改变备份格式、备份服务、搜索、书籍、摘记或图片数据。
- 使用当前主题色和安全区；小屏与大字号可滚动，按钮有文字与无障碍标签。
- 依照用户的测试偏好，每项运行定向测试；收尾运行一次相关回归、TypeScript、lint 和 `git diff --check`，真机未验证的体验不声称已验收。

## Review Focus

- 本机标记读取失败：自动卡片和提醒都不出现，不能因异常阻止进入书架／管理；任务 1、2、3 测试。
- 搜索或筛选得到零结果但书库并非空：不显示首次说明；任务 1、2 测试。
- 备份概览加载缓慢、失败或页面失焦后返回：不闪现提醒、不使用旧结果覆盖新状态；任务 3 测试。
- 用户点“去备份”后取消分享：不能出现“已安全备份”，提醒仍按已处理标记只出现一次；任务 3、4 测试。
- 新独立版已有记录：迁移帮助必须明确恢复会完整替换，先备份当前记录；任务 4 测试。

---

## 文件分工

- 新建 `src/dataSafety/preferences.ts`：两个本机标记的读取与写入，隔离存储异常。
- 新建 `src/dataSafety/visibility.ts`：纯函数判断首次说明和备份提醒是否可见。
- 新建 `src/dataSafety/FirstUseCard.tsx`、`src/dataSafety/BackupReminderCard.tsx`：小型、可复用且不访问仓储的展示组件。
- 修改 `src/books/BookshelfScreen.tsx`：在真实空书架接入首次说明，读取与写入已处理标记。
- 修改 `src/app/(tabs)/manage.tsx`：读取现有 `BackupService.getOverview()`，显示一次性提醒和常驻帮助入口。
- 新建 `src/app/settings/data-safety.tsx`，修改 `src/app/_layout.tsx`：静态说明页及路由标题。
- 新建 `tests/dataSafety/preferences.test.ts`、`tests/dataSafety/visibility.test.ts`、`tests/dataSafety/FirstUseCard.test.tsx`、`tests/dataSafety/BookshelfIntro.test.tsx`、`tests/dataSafety/ManageTab.test.tsx`、`tests/dataSafety/DataSafetyPage.test.tsx`。

### Task 1：本机标记与显示条件

**Files:**

- Create: `src/dataSafety/preferences.ts`
- Create: `src/dataSafety/visibility.ts`
- Create: `tests/dataSafety/preferences.test.ts`
- Create: `tests/dataSafety/visibility.test.ts`

**Interfaces:**

```ts
export type DataSafetyFlag = 'introSeen' | 'backupReminderHandled';
export type DataSafetyStorage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export function createDataSafetyPreferences(storage: DataSafetyStorage): {
  read(flag: DataSafetyFlag): Promise<boolean | null>;
  mark(flag: DataSafetyFlag): Promise<void>;
};
export const dataSafetyPreferences: ReturnType<typeof createDataSafetyPreferences>;
export function shouldShowIntro(input: { introSeen: boolean | null; totalBooks: number | null; status: string | null; hasConditions: boolean; loading: boolean; resultsCurrent: boolean; bulkMode: boolean }): boolean;
export function shouldShowBackupReminder(input: { handled: boolean | null; bookCount: number | null; lastGeneratedAt: string | null }): boolean;
```

- [ ] **Step 1: Write failing tests.** Assert missing flag reads `false`, saved `'1'` reads `true`, each `mark` writes only its own versioned key (`novel-tracker.data-safety.intro-seen.v1` or `novel-tracker.data-safety.backup-reminder-handled.v1`), rejected `getItem` returns `null`, and rejected `setItem` rejects the `mark` Promise.
- [ ] **Step 2: Pin visibility cases.** Assert intro is true only for `introSeen === false`, `totalBooks === 0`, `status === null`, no conditions, no loading, current results and no bulk mode; assert reminder is true only for `handled === false`, `bookCount > 0`, `lastGeneratedAt === null`. Unknown counts or flags return false.
- [ ] **Step 3: Run red.** `npm.cmd test -- --runInBand tests/dataSafety/preferences.test.ts tests/dataSafety/visibility.test.ts`; expected FAIL because the modules are absent.
- [ ] **Step 4: Implement.** Use `expo-sqlite/kv-store` for the default adapter; `read` converts missing to `false`, `'1'` to `true`, a storage exception to `null`; `mark` writes `'1'`. Implement the two pure predicates without introducing database tables.
- [ ] **Step 5: Run green and commit.** Re-run the two test files, then commit `feat: track data safety guide prompts`.

### Task 2：空书架首次说明

**Files:**

- Create: `src/dataSafety/FirstUseCard.tsx`
- Modify: `src/books/BookshelfScreen.tsx`
- Create: `tests/dataSafety/FirstUseCard.test.tsx`
- Create: `tests/dataSafety/BookshelfIntro.test.tsx`

**Interfaces:**

```ts
export function FirstUseCard(props: { onDismiss(): void; onLearnMore(): void }): React.JSX.Element;
```

- [ ] **Step 1: Write failing card test.** Assert local-storage wording and both buttons are visible; `明白了` calls `onDismiss`, `了解备份` calls `onLearnMore`. In a focused bookshelf integration case, assert the card only appears for a true empty shelf and “＋ 添加小说” remains present and pressable.
- [ ] **Step 2: Run red.** `npm.cmd test -- --runInBand tests/dataSafety/FirstUseCard.test.tsx tests/dataSafety/BookshelfIntro.test.tsx`; expected FAIL because the card does not exist.
- [ ] **Step 3: Implement.** In `BookshelfScreen` focus handling, read `dataSafetyPreferences.read('introSeen')` with an active-request guard; show `FirstUseCard` below the ordinary empty text only when `shouldShowIntro` is true. Either action immediately hides the card and calls `mark('introSeen')` with a caught rejection; “了解备份” navigates to `/settings/data-safety`. Do not delay navigation on a failed write.
- [ ] **Step 4: Run green and commit.** Re-run Task 2 and Task 1 tests; commit `feat: explain local storage on first empty shelf`.

### Task 3：管理页一次性备份提醒

**Files:**

- Create: `src/dataSafety/BackupReminderCard.tsx`
- Modify: `src/app/(tabs)/manage.tsx`
- Create: `tests/dataSafety/ManageTab.test.tsx`

**Interfaces:**

```ts
export function BackupReminderCard(props: { onBackup(): void; onDismiss(): void }): React.JSX.Element;
```

- [ ] **Step 1: Write failing page tests.** Mock `useBackupService`, navigation and preferences. Assert reminder shows when `{ books: 1, lastGeneratedAt: null }` and flag is `false`; `去备份` marks handled and opens `/settings/backup`; `暂不提醒` marks handled and hides it without navigation.
- [ ] **Step 2: Add negative cases.** Assert zero books, a non-null `lastGeneratedAt`, an already handled flag, rejected overview, and rejected preference read never show the reminder; when a focus request completes after unmount or a later request, it must not re-show stale content.
- [ ] **Step 3: Run red.** `npm.cmd test -- --runInBand tests/dataSafety/ManageTab.test.tsx`; expected FAIL because the reminder is absent.
- [ ] **Step 4: Implement.** Load the overview and handled flag on management-tab focus using `useFocusEffect` and cancellation guards; evaluate `shouldShowBackupReminder`. On either explicit action hide immediately and call `mark('backupReminderHandled')` with a caught rejection; retain existing manage actions and navigation. Do not infer that `lastGeneratedAt` proves external file storage.
- [ ] **Step 5: Run green and commit.** Re-run Task 3 and Task 1 tests; commit `feat: show one-time backup reminder in manage`.

### Task 4：常驻使用与迁移指引

**Files:**

- Create: `src/app/settings/data-safety.tsx`
- Modify: `src/app/_layout.tsx`
- Modify: `src/app/(tabs)/manage.tsx`
- Create: `tests/dataSafety/DataSafetyPage.test.tsx`
- Modify: `README.md`

**Interfaces:**

- Route: `/settings/data-safety` → static scrollable page; button routes to `/settings/backup`.

- [ ] **Step 1: Write failing copy and navigation test.** Assert the page explains device-local data, saving `.noveltracker` to an external location, Expo Go and standalone storage not automatically sharing data, restore replacing the current library, backing up new standalone records first, checking books／history／notes／images after restore, and protecting private notes／screenshots from public sharing. Assert the backup button routes to `/settings/backup` and the page never labels a generated backup “已安全备份”.
- [ ] **Step 2: Run red.** `npm.cmd test -- --runInBand tests/dataSafety/DataSafetyPage.test.tsx`; expected FAIL because the route is absent.
- [ ] **Step 3: Implement.** Add the accessible scrollable help page, register its stack title, add “使用与数据安全” under management’s import/export section, and update README with the same manual migration path. Keep backup operations in the existing page only.
- [ ] **Step 4: Run green and commit.** Re-run Task 4 and Task 3 tests; commit `feat: add persistent data safety and migration guide`.

### Task 5：集中回归与真机交接

**Files:** No production changes unless verification reveals a defect; fix such defects in their owning task file and add the focused regression test.

- [ ] **Step 1: Run the focused suite once.** `npm.cmd test -- --runInBand tests/dataSafety tests/backup/backupPage.test.tsx`; expected PASS.
- [ ] **Step 2: Run repository checks.** `npx.cmd tsc --noEmit`, `npx.cmd expo lint`, and `git diff --check`; expected no errors.
- [ ] **Step 3: Verify navigation and wording manually.** With an isolated test library in Expo Go, confirm empty-shelf card and add button coexist, managing one saved book shows the reminder once, the help page opens and links to backup, and returning after dismissal does not repeat prompts. Do not erase the user's current Expo Go data to recreate first launch; record any device-only safe-area or large-text limitation honestly.
- [ ] **Step 4: Summarize status.** Report implemented behavior, tests, remaining iPhone checks and whether the branch is ready for the user's merge/upload request; do not merge or push without a separate request.
