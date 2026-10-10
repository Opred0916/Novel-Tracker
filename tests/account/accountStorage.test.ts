import { accountDatabaseName, accountImageDirectory } from '../../src/account/accountStorage';

test('guest keeps the existing database and image directory', () => {
  expect(accountDatabaseName()).toBe('novel-tracker.db');
  expect(accountImageDirectory()).toBe('novel-tracker');
});

test('each account has its own stable storage namespace', () => {
  const first = '8c53bb6d-51e7-4795-b4dc-327c836b7f90';
  const second = '1175fef0-d9ca-4d4a-b8e0-a38e2dd5b56f';
  expect(accountDatabaseName(first)).toBe('novel-tracker-account-8c53bb6d-51e7-4795-b4dc-327c836b7f90.db');
  expect(accountDatabaseName(first)).not.toBe(accountDatabaseName(second));
  expect(accountImageDirectory(first)).not.toBe(accountImageDirectory(second));
});

test('untrusted account ID cannot escape a storage namespace', () => {
  expect(() => accountDatabaseName('../guest')).toThrow('Invalid account ID');
  expect(() => accountImageDirectory('bad/slash')).toThrow('Invalid account ID');
});
