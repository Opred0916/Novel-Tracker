const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeAccountId(accountId: string): string {
  if (!USER_ID_PATTERN.test(accountId)) throw new Error('Invalid account ID');
  return accountId.toLowerCase();
}

export function accountDatabaseName(accountId?: string): string {
  return accountId ? `novel-tracker-account-${safeAccountId(accountId)}.db` : 'novel-tracker.db';
}

export function accountImageDirectory(accountId?: string): string {
  return accountId ? `novel-tracker-account-${safeAccountId(accountId)}` : 'novel-tracker';
}
