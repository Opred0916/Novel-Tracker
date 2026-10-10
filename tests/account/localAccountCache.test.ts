import { accountCacheDirectories, LocalAccountCache } from '../../src/account/localAccountCache';

const userId = '8c53bb6d-51e7-4795-b4dc-327c836b7f90';

test('cleanup paths are exact account-only directories', () => {
  expect(accountCacheDirectories(userId, 'file:///docs/', 'file:///cache/')).toEqual([
    `file:///docs/novel-tracker-account-${userId}/`,
    `file:///docs/novel-tracker-account-${userId}-restored-images/`,
    `file:///docs/novel-tracker-account-${userId}-preferences/`,
    `file:///cache/novel-tracker-account-${userId}/`,
    `file:///cache/novel-tracker-account-${userId}-backup-operations/`,
  ]);
  expect(() => accountCacheDirectories('../guest', 'file:///docs/', 'file:///cache/')).toThrow();
});

test('closes then deletes only the exact account database and directories', async () => {
  const order: string[] = [];
  const cache = new LocalAccountCache(userId, {
    close: async () => { order.push('close'); },
    deleteDatabase: async name => { order.push(name); },
    removeDirectory: async path => { order.push(path); },
    documentDirectory: 'file:///docs/', cacheDirectory: 'file:///cache/',
  });
  await cache.erase();
  expect(order[0]).toBe('close');
  expect(order[1]).toBe(`novel-tracker-account-${userId}.db`);
  expect(order).not.toContain('novel-tracker.db');
  expect(order).toHaveLength(7);
});
