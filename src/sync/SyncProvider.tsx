import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAccount } from '../account/AccountProvider';
import { useDatabase } from '../storage/AppProvider';
import { getSupabaseClient } from '../account/supabaseClient';
import { ImageTransport } from './imageTransport';
import { ExpoImageFilePort, SupabaseImageStore } from './expoImagePorts';
import { SupabaseSnapshotStore } from './cloudSnapshot';
import { SqliteSyncLocal } from './sqliteSyncLocal';
import { SyncService, type SyncResult } from './SyncService';
import type { ConflictChoices, SyncConflict } from './merge';

type SyncStatus = 'guest' | 'syncing' | 'synced' | 'retry' | 'conflict' | 'error';
type SyncContextValue = {
  status: SyncStatus;
  error: string | null;
  conflicts: SyncConflict[];
  lastSyncedAt: string | null;
  syncNow(): Promise<void>;
  resolve(choices: ConflictChoices): Promise<void>;
  pause(): Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAccount();
  const db = useDatabase();
  const [status, setStatus] = useState<SyncStatus>(user ? 'retry' : 'guest');
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const active = useRef(true);
  const running = useRef<Promise<void> | null>(null);
  const conflictRef = useRef(false);
  const service = useMemo(() => {
    const client = getSupabaseClient();
    if (!user || !client) return null;
    return new SyncService(user.id, new SqliteSyncLocal(db), new SupabaseSnapshotStore(client, user.id),
      new ImageTransport(new SupabaseImageStore(client), new ExpoImageFilePort()));
  }, [db, user]);

  const syncNow = useCallback((): Promise<void> => {
    if (!service || !active.current) return Promise.resolve();
    if (running.current) return running.current;
    const work = (async () => {
      setStatus('syncing'); setError(null);
      try {
        const result: SyncResult = await service.sync();
        if (!active.current) return;
        setStatus(result.status);
        if (result.status === 'conflict') { setConflicts(result.conflicts ?? []); conflictRef.current = true; }
        else if (result.status === 'synced') { setConflicts([]); conflictRef.current = false; setLastSyncedAt(new Date().toISOString()); }
      } catch (cause) {
        if (!active.current) return;
        setStatus('error'); setError(cause instanceof Error ? cause.message : '同步失败，请稍后重试');
      }
    })();
    running.current = work.finally(() => { running.current = null; });
    return running.current;
  }, [service]);

  const resolve = useCallback(async (choices: ConflictChoices): Promise<void> => {
    if (!service || !active.current || running.current) return;
    setStatus('syncing'); setError(null);
    const work = (async () => {
      try {
        const result = await service.resolve(choices);
        if (!active.current) return;
        setStatus(result.status);
        if (result.status === 'conflict') { setConflicts(result.conflicts ?? []); conflictRef.current = true; }
        else if (result.status === 'synced') { setConflicts([]); conflictRef.current = false; setLastSyncedAt(new Date().toISOString()); }
      } catch (cause) {
        if (!active.current) return;
        setStatus('error'); setError(cause instanceof Error ? cause.message : '冲突处理失败');
      }
    })();
    running.current = work.finally(() => { running.current = null; });
    await running.current;
  }, [service]);

  const pause = useCallback(async (): Promise<void> => {
    active.current = false;
    service?.pause();
    if (running.current) await running.current;
  }, [service]);

  useEffect(() => {
    active.current = true;
    if (service) void syncNow();
    const timer = setInterval(() => { if (!conflictRef.current) void syncNow(); }, 15_000);
    const subscription = AppState.addEventListener('change', next => { if (next === 'active' && !conflictRef.current) void syncNow(); });
    return () => { active.current = false; service?.pause(); clearInterval(timer); subscription.remove(); };
  }, [service, syncNow]);

  return <SyncContext.Provider value={{ status, error, conflicts, lastSyncedAt, syncNow, resolve, pause }}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const value = useContext(SyncContext);
  if (!value) throw new Error('Sync provider is not ready');
  return value;
}
