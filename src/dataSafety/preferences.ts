import Storage from 'expo-sqlite/kv-store';

export type DataSafetyFlag = 'introSeen' | 'backupReminderHandled';
export type DataSafetyStorage = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
};

const KEYS: Record<DataSafetyFlag, string> = {
  introSeen: 'novel-tracker.data-safety.intro-seen.v1',
  backupReminderHandled: 'novel-tracker.data-safety.backup-reminder-handled.v1',
};

export function createDataSafetyPreferences(storage: DataSafetyStorage) {
  return {
    async read(flag: DataSafetyFlag): Promise<boolean | null> {
      try {
        return (await storage.getItem(KEYS[flag])) === '1';
      } catch {
        return null;
      }
    },
    async mark(flag: DataSafetyFlag): Promise<void> {
      await storage.setItem(KEYS[flag], '1');
    },
  };
}

export const dataSafetyPreferences = createDataSafetyPreferences(Storage);
