import { strToU8 } from 'fflate';
import type { BackupManifestV3 } from '../backup/backupTypes';
import {
  OPEN_EXPORT_FORMAT,
  OPEN_EXPORT_FORMAT_VERSION,
  type OpenExportDocument,
  type OpenExportFiles,
} from './openExportTypes';

const BOM = '\ufeff';

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[\s\u0000-\u001f]*[=+\-@]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csv(rows: readonly (readonly unknown[])[]): Uint8Array {
  const text = BOM + rows.map(row => `${row.map(csvCell).join(',')}\r\n`).join('');
  return strToU8(text);
}

function imageUses(manifest: BackupManifestV3): Map<string, { usages: string[]; noteIds: string[] }> {
  const uses = new Map<string, { usages: string[]; noteIds: string[] }>();
  const add = (imageId: string, usage: string, noteId?: string) => {
    const value = uses.get(imageId) ?? { usages: [], noteIds: [] };
    if (!value.usages.includes(usage)) value.usages.push(usage);
    if (noteId && !value.noteIds.includes(noteId)) value.noteIds.push(noteId);
    uses.set(imageId, value);
  };
  for (const book of manifest.books) if (book.coverImageId) add(book.coverImageId, 'cover');
  for (const relation of manifest.highlightImages) add(relation.imageId, 'highlight');
  for (const relation of manifest.noteImages) add(relation.imageId, 'note', relation.noteId);
  return uses;
}

function buildReadme(): string {
  return [
    'Novel Tracker 开放格式导出',
    '',
    '这个 ZIP 是可在 App 外查看的个人数据副本，开放格式导出不可直接恢复。',
    '需要在 App 内恢复书库时，请使用 .noveltracker 专用备份文件。',
    '',
    '文件说明：',
    '- library.json：完整数据、稳定 ID 和关联关系。',
    '- books.csv：每本小说一行的易读视图。',
    '- reading-history.csv：每次阅读一行。',
    '- notes.csv：每条摘记一行。',
    '- images.csv：图片路径和用途索引。',
    '- images/：封面、精彩片段和摘记引用的原图。',
    '',
    '未知日期在 JSON 中为 null，在 CSV 中为空。状态英文代码对照：want_to_read=想读、reading=在读、finished=读完、dropped=弃读；作品类型代码对照：romance_male_male=耽美、romance_female_male=言情、romance_female_female=GL、no_romance=无CP、other=其他。',
    '图片用途会在 images.csv 的 usages 列标为 cover（封面）、highlight（精彩片段）或 note（摘记），精确关系以 library.json 为准。',
    'CSV 中以 =、+、- 或 @ 开头的文字可能增加单引号，避免表格软件把它当作公式；JSON 保留原文。',
    '文件未加密，可能包含私人摘记和截图，请妥善保存。',
    '',
  ].join('\r\n');
}

export function createOpenExportFiles(manifest: BackupManifestV3): OpenExportFiles {
  const titles = new Map(manifest.books.map(book => [book.id, book.title]));
  const protagonists = new Map<string, string[]>();
  for (const item of manifest.protagonists) protagonists.set(item.bookId, [...(protagonists.get(item.bookId) ?? []), item.name]);
  const tagNames = new Map(manifest.tags.map(tag => [tag.id, tag.name]));
  const tags = new Map<string, string[]>();
  for (const item of manifest.bookTags) tags.set(item.bookId, [...(tags.get(item.bookId) ?? []), tagNames.get(item.tagId) ?? item.tagId]);
  const noteImages = new Map<string, string[]>();
  for (const item of manifest.noteImages) noteImages.set(item.noteId, [...(noteImages.get(item.noteId) ?? []), item.imageId]);
  const uses = imageUses(manifest);
  const imagePaths = new Map(manifest.images.map(image => [image.id, image.archivePath]));

  const document: OpenExportDocument = {
    exportFormat: OPEN_EXPORT_FORMAT,
    formatVersion: OPEN_EXPORT_FORMAT_VERSION,
    exportedAt: manifest.exportedAt,
    appVersion: manifest.appVersion,
    counts: manifest.counts,
    books: manifest.books,
    protagonists: manifest.protagonists,
    tags: manifest.tags,
    bookTags: manifest.bookTags,
    quickTags: manifest.quickTags,
    readingSessions: manifest.readingSessions,
    notes: manifest.notes,
    noteImages: manifest.noteImages,
    highlightImages: manifest.highlightImages,
    images: manifest.images,
  };

  const booksRows: unknown[][] = [[
    'book_id', 'title', 'author', 'status', 'book_type', 'rating_half_stars', 'protagonists', 'tags', 'cover_path', 'created_at', 'updated_at',
  ]];
  for (const book of manifest.books) booksRows.push([
    book.id, book.title, book.author, book.status, book.bookType, book.ratingHalfStars === null ? null : book.ratingHalfStars / 2,
    (protagonists.get(book.id) ?? []).join('; '), (tags.get(book.id) ?? []).join('; '), book.coverImageId ? imagePaths.get(book.coverImageId) ?? '' : '',
    book.createdAt, book.updatedAt,
  ]);

  const historyRows: unknown[][] = [['session_id', 'book_id', 'book_title', 'ordinal', 'outcome', 'started_on', 'ended_on']];
  for (const session of manifest.readingSessions) historyRows.push([
    session.id, session.bookId, titles.get(session.bookId) ?? '', session.ordinal, session.outcome, session.startedOn, session.endedOn,
  ]);

  const notesRows: unknown[][] = [['note_id', 'book_id', 'book_title', 'body', 'reading_session_id', 'original_recorded_on', 'original_recorded_time', 'source_kind', 'created_at', 'updated_at', 'note_image_ids']];
  for (const note of manifest.notes) notesRows.push([
    note.id, note.bookId, titles.get(note.bookId) ?? '', note.body, note.readingSessionId, note.originalRecordedOn ?? null, note.originalRecordedTime ?? null,
    note.sourceKind ?? 'app', note.createdAt, note.updatedAt, (noteImages.get(note.id) ?? []).join('; '),
  ]);

  const imagesRows: unknown[][] = [['image_id', 'book_id', 'relative_path', 'extension', 'byte_length', 'created_at', 'usages', 'note_ids']];
  for (const image of manifest.images) {
    const usage = uses.get(image.id) ?? { usages: [], noteIds: [] };
    imagesRows.push([image.id, image.bookId, image.archivePath, image.extension, image.byteLength, image.createdAt, usage.usages.join('; '), usage.noteIds.join('; ')]);
  }

  return {
    'README.txt': strToU8(buildReadme()),
    'library.json': strToU8(JSON.stringify(document, null, 2)),
    'books.csv': csv(booksRows),
    'reading-history.csv': csv(historyRows),
    'notes.csv': csv(notesRows),
    'images.csv': csv(imagesRows),
  };
}
