import { AccountDeletionService } from '../../src/account/accountDeletion';

test('server failure leaves the only local account copy untouched', async () => {
  const remote = { deleteCurrentAccount: jest.fn(async () => { throw new Error('server unavailable'); }) };
  const local = { erase: jest.fn(async () => undefined) };
  const auth = { signOut: jest.fn(async () => undefined) };
  await expect(new AccountDeletionService(remote, local, auth).delete()).rejects.toThrow('server unavailable');
  expect(local.erase).not.toHaveBeenCalled();
  expect(auth.signOut).not.toHaveBeenCalled();
});

test('server success clears the local account cache then switches to guest', async () => {
  const order: string[] = [];
  const remote = { deleteCurrentAccount: jest.fn(async () => { order.push('remote'); }) };
  const local = { erase: jest.fn(async () => { order.push('local'); }) };
  const auth = { signOut: jest.fn(async () => { order.push('signout'); }) };
  await new AccountDeletionService(remote, local, auth).delete();
  expect(order).toEqual(['remote', 'local', 'signout']);
});

test('a local cleanup error still signs out a remotely deleted account', async () => {
  const remote = { deleteCurrentAccount: jest.fn(async () => undefined) };
  const local = { erase: jest.fn(async () => { throw new Error('file busy'); }) };
  const auth = { signOut: jest.fn(async () => undefined) };
  await expect(new AccountDeletionService(remote, local, auth).delete()).rejects.toThrow('云端账号已删除，但本机清理未完成');
  expect(auth.signOut).toHaveBeenCalled();
});
