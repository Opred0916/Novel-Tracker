import { SYSTEM_TAG_NAMES } from '../../src/storage/database';
import { groupTags } from '../../src/books/tagCategories';

test('every preset tag appears once in a named category and custom tags have their own group', () => {
  const tags = SYSTEM_TAG_NAMES.map((name, index) => ({ id: String(index), name, isSystem: true }));
  const groups = groupTags([...tags, { id: 'custom', name: '赛博朋克', isSystem: false }]);
  expect(groups.map(group => group.title)).toContain('我的标签');
  expect(groups.flatMap(group => group.tags.map(tag => tag.id))).toHaveLength(tags.length + 1);
  expect(groups.find(group => group.title === '我的标签')?.tags[0].name).toBe('赛博朋克');
  expect(groups.some(group => group.title === '其他预设')).toBe(false);
});
