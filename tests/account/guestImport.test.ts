import { createInMemoryDatabase } from '../helpers/inMemoryDatabase';
import { migrateDatabase } from '../../src/storage/database';
import { GuestImportService } from '../../src/account/guestImport';

test('copies guest books once without deleting the guest library', async () => {
  const guest = createInMemoryDatabase();
  const account = createInMemoryDatabase();
  try {
    await migrateDatabase(guest);
    await migrateDatabase(account);
    await guest.runAsync("INSERT INTO books (id,title,status,created_at,updated_at) VALUES ('guest-book','旧书','finished','2026-10-10T00:00:00.000Z','2026-10-10T00:00:00.000Z')");
    const files = { read: jest.fn(), write: jest.fn(), size: jest.fn() };
    const service = new GuestImportService(guest, account, files);
    expect(await service.offer()).toEqual({ guestBooks: 1, alreadyImported: false });
    await service.import('8c53bb6d-51e7-4795-b4dc-327c836b7f90');
    expect((await account.getAllAsync<{ id: string }>('SELECT id FROM books')).map(row => row.id)).toEqual(['guest-book']);
    expect((await guest.getAllAsync<{ id: string }>('SELECT id FROM books')).map(row => row.id)).toEqual(['guest-book']);
    expect(await service.offer()).toEqual({ guestBooks: 1, alreadyImported: true });
    await expect(service.import('8c53bb6d-51e7-4795-b4dc-327c836b7f90')).rejects.toThrow('已经导入');
  } finally { guest.close(); account.close(); }
});
