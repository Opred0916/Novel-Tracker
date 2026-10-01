import { randomUUID } from 'expo-crypto';
import type { Database } from '../storage/database';
import type { Tag } from './types';

type TagRow = { id: string; name: string; is_system: number };
const toTag = (row: TagRow): Tag => ({ id: row.id, name: row.name, isSystem: row.is_system === 1 });

export class SqliteTagRepository {
  constructor(private readonly db: Database, private readonly idFactory: () => string = randomUUID) {}

  async list(): Promise<Tag[]> {
    return (await this.db.getAllAsync<TagRow>('SELECT id, name, is_system FROM tags ORDER BY is_system DESC, rowid')).map(toTag);
  }

  async create(name: string): Promise<Tag> {
    const normalized = typeof name === 'string' ? name.trim() : '';
    if (!normalized) throw new Error('请输入标签名称');
    const tag: Tag = { id: this.idFactory(), name: normalized, isSystem: false };
    await this.db.runAsync('INSERT INTO tags (id, name, is_system) VALUES (?, ?, 0)', tag.id, tag.name);
    return tag;
  }

  async delete(id: string): Promise<void> {
    const tag = await this.db.getFirstAsync<TagRow>('SELECT id, name, is_system FROM tags WHERE id = ?', id);
    if (!tag) throw new Error('找不到标签');
    if (tag.is_system) throw new Error('不能删除系统标签');
    await this.db.runAsync('DELETE FROM tags WHERE id = ?', id);
  }

  async listQuick(): Promise<Tag[]> {
    return (await this.db.getAllAsync<TagRow>(
      'SELECT t.id, t.name, t.is_system FROM quick_tags q JOIN tags t ON t.id = q.tag_id ORDER BY q.position',
    )).map(toTag);
  }

  async setQuick(ids: string[]): Promise<void> {
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string' || !id.trim())) throw new Error('快捷标签无效');
    const unique = [...new Set(ids)];
    await this.db.withExclusiveTransactionAsync(async txn => {
      for (const id of unique) {
        if (!await txn.getFirstAsync('SELECT id FROM tags WHERE id = ?', id)) throw new Error('找不到标签');
      }
      await txn.runAsync('DELETE FROM quick_tags');
      for (const [position, id] of unique.entries()) {
        await txn.runAsync('INSERT INTO quick_tags (tag_id, position) VALUES (?, ?)', id, position);
      }
    });
  }
}
