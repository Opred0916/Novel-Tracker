import { createDataSafetyPreferences } from '../../src/dataSafety/preferences';

test('a missing prompt flag is not yet handled', async () => {
  const storage = { getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn() };
  const preferences = createDataSafetyPreferences(storage);
  expect(await preferences.read('introSeen')).toBe(false);
  expect(storage.getItem).toHaveBeenCalledWith('novel-tracker.data-safety.intro-seen.v1');
});

test('a saved prompt flag stays handled across reads', async () => {
  const storage = { getItem: jest.fn().mockResolvedValue('1'), setItem: jest.fn() };
  expect(await createDataSafetyPreferences(storage).read('backupReminderHandled')).toBe(true);
});

test('handling one prompt does not mark the other', async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
  };
  const preferences = createDataSafetyPreferences(storage);
  await preferences.mark('introSeen');
  expect(await preferences.read('introSeen')).toBe(true);
  expect(await preferences.read('backupReminderHandled')).toBe(false);
  await preferences.mark('backupReminderHandled');
  expect(storage.setItem).toHaveBeenNthCalledWith(1, 'novel-tracker.data-safety.intro-seen.v1', '1');
  expect(storage.setItem).toHaveBeenNthCalledWith(2, 'novel-tracker.data-safety.backup-reminder-handled.v1', '1');
});

test('storage read failure leaves prompt state unknown', async () => {
  const storage = { getItem: jest.fn().mockRejectedValue(new Error('unavailable')), setItem: jest.fn() };
  expect(await createDataSafetyPreferences(storage).read('introSeen')).toBeNull();
});

test('storage write failure rejects without claiming the prompt was saved', async () => {
  const storage = { getItem: jest.fn(), setItem: jest.fn().mockRejectedValue(new Error('full')) };
  await expect(createDataSafetyPreferences(storage).mark('backupReminderHandled')).rejects.toThrow('full');
});
