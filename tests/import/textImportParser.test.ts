import {
  decodeImportUtf8,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_CANDIDATES,
  parseTextImport,
} from '../../src/import/textImportParser';

describe('text import parser', () => {
  test('parses one book per line without treating a bare numeric title as an ordinal', () => {
    const result = parseTextImport('残次品\n1984\n  \n', 'lines', 'want_to_read');
    expect(result.candidates.map(item => item.title)).toEqual(['残次品', '1984']);
    expect(result.candidates[0]).toMatchObject({ status: 'want_to_read', sourceLine: 1, sourceText: '残次品' });
  });

  test('parses labeled blocks and preserves explicit fields', () => {
    const result = parseTextImport([
      '书名：残次品', '作者：Priest', '主角：林静恒、陆必行', '状态：已读', '评分：4.5',
      '摘记：第一次读完很喜欢', '日期：2024-10-27 12:12', '',
      '书名：没有字段的书',
    ].join('\n'), 'blocks', 'want_to_read');
    expect(result.candidates[0]).toMatchObject({ title: '残次品', author: 'Priest', protagonists: ['林静恒', '陆必行'], status: 'finished', ratingHalfStars: 9 });
    expect(result.candidates[0].notes[0]).toMatchObject({ body: '第一次读完很喜欢', originalRecordedOn: '2024-10-27', originalRecordedTime: '12:12' });
    expect(result.candidates[1].title).toBe('没有字段的书');
  });

  test('parses numbered book replies and keeps reply text as notes', () => {
    const result = parseTextImport([
      'Purani_ 博主：144残次品', '24-10-27 12:12 来自 江苏', 'top1', 'top3', '共4条回复',
      'Purani_ 博主：54 重生之鲸然', '22-5-23 23:12 来自 江苏', '重生之鲸然', '好喜欢他们',
    ].join('\n'), 'numbered_replies', 'want_to_read');
    expect(result.candidates.map(item => item.title)).toEqual(['残次品', '重生之鲸然']);
    expect(result.candidates[0].notes.map(note => note.body)).toEqual(['top1', 'top3']);
    expect(result.candidates[0].notes[0]).toMatchObject({ originalRecordedOn: '2024-10-27', originalRecordedTime: '12:12' });
    expect(result.warnings.some(warning => warning.includes('共4条回复'))).toBe(true);
    expect(result.fragments.some(fragment => fragment.text === '共4条回复')).toBe(true);
  });

  test('uses explicit status and ignores social UI metadata', () => {
    const result = parseTextImport('144 残次品\n2026-10-02\n来自 江苏\n点赞 1\n', 'numbered_replies', 'reading');
    expect(result.candidates[0].status).toBe('reading');
    expect(result.candidates[0].title).toBe('残次品');
    expect(result.candidates[0].author).toBeNull();
  });

  test('supports UTF-8 BOM, emoji, CRLF, and warns about two-digit years', () => {
    const value = '\uFEFF书名：猫🐱\r\n日期：24-10-27 12:12\r\n';
    const result = parseTextImport(value, 'blocks', 'want_to_read');
    expect(result.candidates[0].title).toBe('猫🐱');
    expect(result.warnings.some(warning => warning.includes('两位数年份'))).toBe(true);
  });

  test('rejects URL-only input and exposes unknown fragments', () => {
    expect(() => parseTextImport('https://weibo.com/7448217576/LdsyF8rqS', 'lines', 'want_to_read')).toThrow();
    const result = parseTextImport('144 残次品\n没有层级的回复\n', 'numbered_replies', 'want_to_read');
    expect(result.fragments.some(fragment => fragment.text === '没有层级的回复')).toBe(true);
  });

  test('strictly decodes UTF-8 and enforces byte and candidate limits', () => {
    expect(decodeImportUtf8(new TextEncoder().encode('\uFEFF残次品'))).toBe('残次品');
    expect(() => decodeImportUtf8(new Uint8Array([0xc3, 0x28]))).toThrow('UTF-8');
    expect(() => decodeImportUtf8(new Uint8Array(MAX_IMPORT_BYTES + 1))).toThrow('1 MiB');
    const tooMany = Array.from({ length: MAX_IMPORT_CANDIDATES + 1 }, (_, index) => `书${index}`).join('\n');
    expect(() => parseTextImport(tooMany, 'lines', 'want_to_read')).toThrow('500');
  });
});
