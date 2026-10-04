import type { BookType, Tag } from './types';

export type BulkTypeChange =
  | { kind: 'keep' }
  | { kind: 'set'; value: BookType }
  | { kind: 'clear' };

export type BulkOrganizeDraft = {
  addTagIds: string[];
  removeTagIds: string[];
  newTags: Pick<Tag, 'id' | 'name'>[];
  typeChange: BulkTypeChange;
};

export type BulkBookSnapshot = {
  id: string;
  title: string;
  author: string | null;
  updatedAt: string;
  bookType: BookType | null;
  tagIds: string[];
};

export type BulkOrganizeItemPreview = {
  before: BulkBookSnapshot;
  after: { bookType: BookType | null; tagIds: string[] };
  addedTagIds: string[];
  removedTagIds: string[];
  typeChanged: boolean;
  changed: boolean;
};

export type BulkOrganizePreview = {
  draft: BulkOrganizeDraft;
  items: BulkOrganizeItemPreview[];
  selectedCount: number;
  changedCount: number;
  unchangedCount: number;
  addAffectedBookCount: number;
  removeAffectedBookCount: number;
  typeAffectedBookCount: number;
};

function normalizeName(name: string): string {
  return name.trim().normalize('NFKC').toLocaleLowerCase();
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function validateDraft(tags: Tag[], draft: BulkOrganizeDraft): { addTagIds: string[]; removeTagIds: string[]; newTags: Pick<Tag, 'id' | 'name'>[] } {
  const addTagIds = uniqueIds(draft.addTagIds);
  const removeTagIds = uniqueIds(draft.removeTagIds);
  if (addTagIds.some(id => removeTagIds.includes(id))) throw new Error('标签不能同时添加和移除');

  const existingById = new Map(tags.map(tag => [tag.id, tag]));
  for (const id of [...addTagIds, ...removeTagIds]) {
    if (!existingById.has(id) && !draft.newTags.some(tag => tag.id === id)) throw new Error('找不到标签');
  }
  if (removeTagIds.some(id => draft.newTags.some(tag => tag.id === id))) throw new Error('新标签只能用于添加');

  const names = new Set(tags.map(tag => normalizeName(tag.name)));
  const newIds = new Set<string>();
  const newNames = new Set<string>();
  const newTags = draft.newTags.map(tag => {
    const name = tag.name.trim().normalize('NFKC');
    if (!name) throw new Error('标签名称不能为空');
    const normalized = normalizeName(name);
    if (names.has(normalized) || newNames.has(normalized)) throw new Error('标签名称已存在');
    if (!tag.id.trim() || newIds.has(tag.id)) throw new Error('新标签无效');
    newIds.add(tag.id);
    newNames.add(normalized);
    return { id: tag.id, name };
  });
  if (newTags.some(tag => !addTagIds.includes(tag.id))) throw new Error('新标签只能用于添加');
  return { addTagIds, removeTagIds, newTags };
}

export function calculateBulkPreview(books: BulkBookSnapshot[], tags: Tag[], draft: BulkOrganizeDraft): BulkOrganizePreview {
  const validated = validateDraft(tags, draft);
  const allTagIds = [...validated.addTagIds];
  const items = books.map(book => {
    const beforeTagIds = [...book.tagIds];
    const removedTagIds = validated.removeTagIds.filter(id => beforeTagIds.includes(id));
    const addedTagIds = allTagIds.filter(id => !beforeTagIds.includes(id));
    const remaining = beforeTagIds.filter(id => !validated.removeTagIds.includes(id));
    const tagIds = [...remaining, ...addedTagIds];
    const bookType = draft.typeChange.kind === 'keep'
      ? book.bookType
      : draft.typeChange.kind === 'clear' ? null : draft.typeChange.value;
    const typeChanged = bookType !== book.bookType;
    return {
      before: { ...book, tagIds: beforeTagIds },
      after: { bookType, tagIds },
      addedTagIds,
      removedTagIds,
      typeChanged,
      changed: typeChanged || addedTagIds.length > 0 || removedTagIds.length > 0,
    };
  });
  const changedItems = items.filter(item => item.changed);
  return {
    draft: { ...draft, addTagIds: validated.addTagIds, removeTagIds: validated.removeTagIds, newTags: validated.newTags.map(tag => ({ ...tag })) },
    items,
    selectedCount: books.length,
    changedCount: changedItems.length,
    unchangedCount: items.length - changedItems.length,
    addAffectedBookCount: items.filter(item => item.addedTagIds.length > 0).length,
    removeAffectedBookCount: items.filter(item => item.removedTagIds.length > 0).length,
    typeAffectedBookCount: items.filter(item => item.typeChanged).length,
  };
}

