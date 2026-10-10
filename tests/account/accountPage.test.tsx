import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import AccountPage from '../../src/app/settings/account';
import { useAccount } from '../../src/account/AccountProvider';
import { useSync } from '../../src/sync/SyncProvider';

jest.mock('../../src/account/AccountProvider', () => ({ useAccount: jest.fn() }));
jest.mock('../../src/sync/SyncProvider', () => ({ useSync: jest.fn() }));
const mockAccountDb = { closeAsync: jest.fn() };
jest.mock('../../src/storage/AppProvider', () => ({ useDatabase: () => mockAccountDb }));
jest.mock('../../src/storage/database', () => ({ openDatabase: jest.fn(async () => ({ closeAsync: jest.fn() })) }));
jest.mock('../../src/account/guestImport', () => ({ GuestImportService: class { offer = async () => ({ guestBooks: 2, alreadyImported: false }); } }));

const sync = { status: 'synced', error: null, conflicts: [], lastSyncedAt: null, syncNow: jest.fn(), resolve: jest.fn(), pause: jest.fn() };

beforeEach(() => {
  jest.mocked(useSync).mockReturnValue(sync as unknown as ReturnType<typeof useSync>);
});

test('without cloud configuration, guest mode remains visible and usable', async () => {
  jest.mocked(useAccount).mockReturnValue({ user: null, configured: false, sendCode: jest.fn(), verifyCode: jest.fn(), signOut: jest.fn() });
  const screen = await render(<AccountPage />);
  expect(screen.getByText(/云同步尚未配置/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: '发送验证码' })).toBeNull();
});

test('signed-in account shows sync state, import choice and deletion entry', async () => {
  jest.mocked(useAccount).mockReturnValue({ user: { id: '8c53bb6d-51e7-4795-b4dc-327c836b7f90', email: 'reader@example.com' } as ReturnType<typeof useAccount>['user'], configured: true, sendCode: jest.fn(), verifyCode: jest.fn(), signOut: jest.fn() });
  const screen = await render(<AccountPage />);
  expect(screen.getByText('同步状态：已同步')).toBeTruthy();
  await waitFor(() => expect(screen.getByRole('button', { name: /复制未登录书库的 2 本小说/ })).toBeTruthy());
  expect(screen.getByRole('button', { name: '删除账号' })).toBeTruthy();
});
