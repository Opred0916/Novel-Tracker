import { router } from 'expo-router';
import { useState } from 'react';
import type { BookStatus } from '../../books/types';
import { ImportReviewList } from '../../import/ImportReviewList';
import { ImportSourceForm } from '../../import/ImportSourceForm';
import { TableImportMapping } from '../../import/TableImportMappingView';
import { TableImportSource } from '../../import/TableImportSource';
import { findImportDuplicates, type DuplicateHint, type ImportReview } from '../../import/importReview';
import { decodeImportUtf8, parseTextImport } from '../../import/textImportParser';
import type { ImportMode, ImportParseResult } from '../../import/importTypes';
import { pickImportTable, pickImportTxt } from '../../import/importPlatform';
import { parseCsvTable, parseXlsxTables } from '../../import/tableImportParser';
import type { TableSheet } from '../../import/tableImportTypes';
import { useBooks, useImportCommitService, useNotes, useTags } from '../../storage/AppProvider';

export default function ImportPage() {
  const books = useBooks();
  const notes = useNotes();
  const tags = useTags();
  const service = useImportCommitService();
  const [text, setText] = useState('');
  const [mode, setMode] = useState<ImportMode>('blocks');
  const [defaultStatus, setDefaultStatus] = useState<BookStatus>('want_to_read');
  const [review, setReview] = useState<ImportReview | null>(null);
  const [hints, setHints] = useState<DuplicateHint[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tableDelimiter, setTableDelimiter] = useState<',' | ';' | '\t'>(';');
  const [tableStep, setTableStep] = useState<'source' | 'sheet' | 'mapping'>('source');
  const [tableFileName, setTableFileName] = useState('');
  const [tableSheets, setTableSheets] = useState<TableSheet[]>([]);
  const [tableSheetIndex, setTableSheetIndex] = useState(0);
  const [availableTags, setAvailableTags] = useState<ReadonlyMap<string, string>>(new Map());

  async function buildReview(result: ImportParseResult) {
    const existingBooks = await books.list();
    const existingNotes = (await Promise.all(existingBooks.map(book => notes.listNotes(book.id)))).flat();
    const next: ImportReview = {
      items: result.candidates.map(candidate => ({ candidate, action: 'create', targetBookId: null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] })),
      fragments: result.fragments, ignoredFragmentIds: [], warnings: result.warnings,
    };
    setReview(next);
    setHints(findImportDuplicates(next, existingBooks.map(book => ({ id: book.id, title: book.title, author: book.author })), existingNotes.map(note => ({ id: note.id, bookId: note.bookId, body: note.body }))));
  }

  async function parse(value = text) {
    setError('');
    try { await buildReview(parseTextImport(value, mode, defaultStatus)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '无法解析这段文字'); }
  }

  async function pickFile() {
    setError('');
    try {
      const picked = await pickImportTxt();
      if (!picked) return;
      const decoded = decodeImportUtf8(picked.bytes);
      setText(decoded);
      await parse(decoded);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '读取 TXT 失败'); }
  }

  async function pickTable() {
    setError('');
    try {
      const picked = await pickImportTable();
      if (!picked) return;
      const listedTags = await tags.list();
      setAvailableTags(new Map(listedTags.map(tag => [tag.name, tag.id])));
      const sheets = picked.kind === 'csv' ? [parseCsvTable(picked.bytes, tableDelimiter)] : parseXlsxTables(picked.bytes);
      setTableFileName(picked.name); setTableSheets(sheets); setTableSheetIndex(0); setTableStep(picked.kind === 'xlsx' ? 'sheet' : 'mapping');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '读取表格失败'); }
  }

  function manualCandidate() {
    setError('');
    const candidate = {
      id: `manual-${Date.now()}`, sourceLine: 0, sourceText: '', title: '', author: null, protagonists: [], status: defaultStatus,
      ratingHalfStars: null, bookType: null, tagIds: [], sessions: [], notes: [], whyWantToRead: null, platform: null,
    };
    setReview({ items: [{ candidate, action: 'create', targetBookId: null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] }], fragments: [], ignoredFragmentIds: [] });
    setHints([]);
  }

  async function confirm() {
    if (!review || busy) return;
    setBusy(true); setError('');
    try { await service.commit(review); router.replace('/'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '导入失败，请检查预览后重试'); }
    finally { setBusy(false); }
  }

  if (review) return <ImportReviewList review={review} hints={hints} busy={busy} onChange={setReview} onConfirm={() => { void confirm(); }} onCancel={() => { if (!busy) setReview(null); }} />;
  if (tableStep === 'sheet') return <TableImportSource fileName={tableFileName} sheets={tableSheets} onSelect={index => { setTableSheetIndex(index); setTableStep('mapping'); }} onCancel={() => { setTableStep('source'); setTableSheets([]); }} />;
  if (tableStep === 'mapping' && tableSheets[tableSheetIndex]) return <TableImportMapping sheet={tableSheets[tableSheetIndex]} defaultStatus={defaultStatus} tagIdsByName={availableTags} onMapped={result => { setTableStep('source'); void buildReview(result); }} onBack={() => { setTableStep(tableSheets.length > 1 ? 'sheet' : 'source'); }} />;
  return <ImportSourceForm text={text} mode={mode} defaultStatus={defaultStatus} error={error} tableDelimiter={tableDelimiter} onTableDelimiterChange={setTableDelimiter} onTextChange={setText} onModeChange={setMode} onStatusChange={setDefaultStatus} onPickFile={() => { void pickFile(); }} onPickTable={() => { void pickTable(); }} onParse={() => { void parse(); }} onManualCandidate={manualCandidate} />;
}
