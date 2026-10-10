# Account and Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional email accounts with safe automatic cross-device sync for the complete library and images.

**Architecture:** Keep SQLite as the offline source, with separate databases per account. Store a versioned library manifest in Supabase Postgres and media in a private Storage bucket. A three-way merge against each device's last synced manifest applies independent edits automatically and surfaces conflicting edits for resolution.

**Tech Stack:** Expo SDK 57, React Native, Expo Router, TypeScript, SQLite, Supabase Auth/Postgres/Storage, Jest.

**Spec:** `docs/superpowers/specs/2026-10-10-account-cloud-sync-design.md`

## Global Constraints

- Guest mode and existing `novel-tracker.db` remain usable without cloud configuration.
- Do not place a service role key in the app; use publishable key plus RLS.
- Sync books, sessions, notes, tags, covers, and note images; OCR remains a local cache.
- No silent overwrite on concurrent edits or edit-versus-delete.
- Do not delete guest records during first login or sign-out.
- Follow `AGENTS.md`: SDK 57 docs, Expo Router, `npx expo install`, lint and typecheck.

## Review Focus

- Second device has empty local data but nonempty cloud: it downloads all records and images.
- Both devices add different books offline: both survive after reconnect.
- Two edits to one note or an edit against deletion: conflict is retained and visible.
- Image upload fails after local write: the cloud manifest never references a missing image.
- Sign out then sign in as another user: no cross-account records or media appear.

---

### Task 1: Cloud schema and auth client

**Files:** Create `supabase/migrations/20261010_account_sync.sql`, `src/account/supabaseClient.ts`, `.env.example`; modify `package.json`, `app.json`, `.gitignore`; test `tests/account/supabaseConfig.test.ts`.

**Interfaces:** `getSupabaseClient(): SupabaseClient | null`; `isCloudConfigured(): boolean`. SQL creates owner-only library row, private image bucket, CAS RPC, and deletion function or server-side endpoint.

- [ ] Write failing configuration tests for absent, malformed and valid public URL/key; run targeted Jest and see failure.
- [ ] Install SDK-compatible client/session dependencies with `npx expo install` and implement configuration; rerun tests.
- [ ] Add SQL with RLS, owner-scoped storage paths and revision-checking RPC; review policies with two user IDs.
- [ ] Commit schema, config and tests.

### Task 2: Account lifecycle and data isolation

**Files:** Create `src/account/AccountProvider.tsx`, `src/account/accountStorage.ts`, `src/app/settings/account.tsx`; modify `src/storage/AppProvider.tsx`, `src/storage/database.ts`, `src/app/_layout.tsx`, `src/app/(tabs)/manage.tsx`; test `tests/account/accountStorage.test.ts`, `tests/account/accountPage.test.tsx`.

**Interfaces:** `useAccount(): { user, status, sendCode(email), verifyCode(email, code), signOut() }`; `openDatabase(accountId?: string): Promise<Database>`; `accountDatabaseName(accountId?: string): string`.

- [ ] Write failing tests for guest database continuity, distinct account filenames, login errors and logout routing; run targeted Jest.
- [ ] Implement OTP session persistence and per-account provider remount; rerun tests.
- [ ] Add account screen and management entry; verify login flow with a configured test project.
- [ ] Commit account UI and isolation.

### Task 3: Three-way manifest merge

**Files:** Create `src/sync/merge.ts`, `src/sync/syncTypes.ts`; test `tests/sync/merge.test.ts`.

**Interfaces:** `mergeManifests(base, local, remote): { manifest, conflicts }`; `resolveConflicts(input, decisions): BackupManifestV4`.

- [ ] Write failing tests for independent additions, same-ID edits, delete-versus-edit, relationships and invalid references; run targeted Jest.
- [ ] Implement deterministic collection merge and `validateBackupManifest` guard; rerun tests.
- [ ] Commit merge engine and tests.

### Task 4: Local sync metadata and safe apply

**Files:** Create `src/sync/localSyncStore.ts`; modify `src/storage/database.ts`, `src/backup/backupRepository.ts`; test `tests/sync/localSyncStore.test.ts`.

**Interfaces:** `readBaseline(userId)`, `saveBaseline(userId, revision, manifest)`, `readLocalRevision()`, `replaceAllIfRevision(manifest, imagePaths, expectedRevision)`.

- [ ] Write failing SQLite tests for baseline persistence, revision increments on every synced table, and aborted apply after concurrent local edit; run targeted Jest.
- [ ] Add sync metadata and change triggers; make backup replacement check expected revision inside its transaction; rerun tests.
- [ ] Commit local sync safety layer.

### Task 5: Private image transport

**Files:** Create `src/sync/imageTransport.ts`; test `tests/sync/imageTransport.test.ts`.

**Interfaces:** `uploadMissingImages(userId, snapshot)`, `downloadMissingImages(userId, manifest, localPaths)`; both validate owner path and media length.

- [ ] Write failing tests for upload-before-manifest order, missing file, failed upload, byte-length mismatch and authenticated download; run targeted Jest.
- [ ] Implement with Expo File and Supabase Storage; rerun tests.
- [ ] Commit media transport.

### Task 6: Sync coordinator and conflict UI

**Files:** Create `src/sync/SyncService.ts`, `src/sync/SyncProvider.tsx`, `src/app/settings/sync-conflicts.tsx`; modify `src/app/settings/account.tsx`, `src/storage/AppProvider.tsx`; test `tests/sync/SyncService.test.ts`, `tests/account/syncStatus.test.tsx`.

**Interfaces:** `SyncService.sync(): Promise<SyncResult>`; `useSync(): { status, syncNow, conflicts, resolve }`.

- [ ] Write failing tests for initial upload/download, CAS retry, independent edit merge, paused conflict, local edit during apply and offline retry; run targeted Jest.
- [ ] Implement serial sync on login, foreground, local revision change and timer; rerun tests.
- [ ] Add explicit status/retry/conflict selection UI and recovery copy; rerun UI tests.
- [ ] Commit coordinator and UI.

### Task 7: Account deletion and end-to-end acceptance

**Files:** Modify `src/app/settings/account.tsx`, `supabase/migrations/20261010_account_sync.sql`, `README.md`; test `tests/account/accountDeletion.test.ts`, `tests/sync/twoDevice.test.ts`.

- [ ] Write failing tests for failed server deletion preserving local cache and successful deletion switching to guest; run targeted Jest.
- [ ] Implement protected server-side account deletion and user confirmation; rerun tests.
- [ ] Simulate two devices with independent local stores and one fake cloud; verify all Review Focus cases.
- [ ] Run full Jest, `npx expo lint`, `npx tsc --noEmit`, and `npx expo-doctor`; document any external Supabase setup or real-device verification still required.
- [ ] Commit tested feature and instructions; do not push unless the user asks.
