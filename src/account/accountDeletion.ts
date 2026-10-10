import type { SupabaseClient } from '@supabase/supabase-js';

type RemoteDeletion = { deleteCurrentAccount(): Promise<void> };
type LocalDeletion = { erase(): Promise<void> };
type AuthSignOut = { signOut(): Promise<void> };

export class AccountDeletionService {
  constructor(private readonly remote: RemoteDeletion, private readonly local: LocalDeletion, private readonly auth: AuthSignOut) {}

  async delete(): Promise<void> {
    // Do not erase the only local copy while the server still owns the account.
    await this.remote.deleteCurrentAccount();
    let cleanupError: unknown = null;
    try { await this.local.erase(); }
    catch (error) { cleanupError = error; }
    try { await this.auth.signOut(); }
    catch (error) { cleanupError ??= error; }
    if (cleanupError) throw new Error(`云端账号已删除，但本机清理未完成：${String(cleanupError)}`);
  }
}

export class SupabaseAccountDeletion {
  constructor(private readonly client: SupabaseClient) {}

  async deleteCurrentAccount(): Promise<void> {
    const { data, error } = await this.client.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw new Error(`云端删除失败：${error.message}`);
    if (!data || data.ok !== true) throw new Error('云端未确认删除账号');
  }
}
