import { calculateBulkPreview, type BulkBookSnapshot, type BulkOrganizeDraft } from '../../src/books/bulkOrganize';

const books: BulkBookSnapshot[] = [
  { id: 'book-a', title: '甲书', author: '作者甲', updatedAt: '2026-10-01T00:00:00.000Z', bookType: 'romance_male_male', tagIds: ['ancient', 'suspense'] },
  { id: 'book-b', title: '乙书', author: '作者乙', updatedAt: '2026-10-02T00:00:00.000Z', bookType: null, tagIds: ['modern'] },
];
const tags = [
  { id: 'ancient', name: '古代', isSystem: true },
  { id: 'suspense', name: '悬疑', isSystem: true },
  { id: 'modern', name: '现代', isSystem: true },
  { id: 'custom', name: '赛博朋克', isSystem: false },
];

test('calculates combined tag and type changes without mutating snapshots', () => {
  const draft: BulkOrganizeDraft = {
    addTagIds: ['modern', 'custom'],
    removeTagIds: ['suspense'],
    newTags: [],
    typeChange: { kind: 'set', value: 'other' },
  };
  const before = structuredClone(books);

  const preview = calculateBulkPreview(books, tags, draft);

  expect(preview.items.map(item => item.after)).toEqual([
    { bookType: 'other', tagIds: ['ancient', 'modern', 'custom'] },
    { bookType: 'other', tagIds: ['modern', 'custom'] },
  ]);
  expect(preview).toMatchObject({ selectedCount: 2, changedCount: 2, unchangedCount: 0, addAffectedBookCount: 2, removeAffectedBookCount: 1, typeAffectedBookCount: 2 });
  expect(books).toEqual(before);
});

test('supports keep and clear type changes and counts unchanged items', () => {
  const keep = calculateBulkPreview(books, tags, { addTagIds: [], removeTagIds: [], newTags: [], typeChange: { kind: 'keep' } });
  expect(keep.changedCount).toBe(0);
  expect(keep.unchangedCount).toBe(2);

  const clear = calculateBulkPreview(books, tags, { addTagIds: [], removeTagIds: [], newTags: [], typeChange: { kind: 'clear' } });
  expect(clear.items.map(item => item.after.bookType)).toEqual([null, null]);
  expect(clear.changedCount).toBe(1);
  expect(clear.typeAffectedBookCount).toBe(1);
});

test('rejects conflicting or invalid tag operations and duplicate custom names', () => {
  expect(() => calculateBulkPreview(books, tags, { addTagIds: ['ancient'], removeTagIds: ['ancient'], newTags: [], typeChange: { kind: 'keep' } })).toThrow('标签不能同时添加和移除');
  expect(() => calculateBulkPreview(books, tags, { addTagIds: ['missing'], removeTagIds: [], newTags: [], typeChange: { kind: 'keep' } })).toThrow('找不到标签');
  expect(() => calculateBulkPreview(books, tags, { addTagIds: ['new'], removeTagIds: [], newTags: [{ id: 'new', name: '古代' }], typeChange: { kind: 'keep' } })).toThrow('标签名称已存在');
  expect(() => calculateBulkPreview(books, tags, { addTagIds: [], removeTagIds: [], newTags: [{ id: 'new', name: '   ' }], typeChange: { kind: 'keep' } })).toThrow('标签名称不能为空');
});

