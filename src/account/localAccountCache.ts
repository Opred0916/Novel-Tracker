import { accountDatabaseName, accountImageDirectory } from './accountStorage';

type CachePort = {
  close(): Promise<void>;
  deleteDatabase(name: string): Promise<void>;
  removeDirectory(path: string): Promise<void>;
  documentDirectory: string | null;
  cacheDirectory: string | null;
};

function child(root: string, name: string): string {
  const parsed = new URL(root);
  if (parsed.protocol !== 'file:' || parsed.search || parsed.hash) throw new Error('无效的本地目录');
  return `${root.replace(/\/+$/, '')}/${name}/`;
}

export function accountCacheDirectories(accountId: string, documentDirectory: string | null, cacheDirectory: string | null): string[] {
  const name = accountImageDirectory(accountId);
  if (!documentDirectory || !cacheDirectory) throw new Error('无法打开本地存储目录');
  return [
    child(documentDirectory, name),
    child(documentDirectory, `${name}-restored-images`),
    child(documentDirectory, `${name}-preferences`),
    child(cacheDirectory, name),
    child(cacheDirectory, `${name}-backup-operations`),
  ];
}

export class LocalAccountCache {
  constructor(private readonly accountId: string, private readonly port: CachePort) {}

  async erase(): Promise<void> {
    const databaseName = accountDatabaseName(this.accountId);
    const directories = accountCacheDirectories(this.accountId, this.port.documentDirectory, this.port.cacheDirectory);
    await this.port.close();
    await this.port.deleteDatabase(databaseName);
    for (const directory of directories) await this.port.removeDirectory(directory);
  }
}
