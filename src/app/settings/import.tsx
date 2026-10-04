import { router } from 'expo-router';
import { Alert } from 'react-native';
import { useRef, useState } from 'react';
import type { BookStatus } from '../../books/types';
import { getLocalImageTextRecognizer } from '../../books/localImageTextRecognizer';
import { ImportReviewList } from '../../import/ImportReviewList';
import { ImportSourceForm } from '../../import/ImportSourceForm';
import { ScreenshotImportSource } from '../../import/ScreenshotImportSource';
import { TableImportMapping } from '../../import/TableImportMappingView';
import { TableImportSource } from '../../import/TableImportSource';
import { findImportDuplicates, type DuplicateHint, type ImportReview } from '../../import/importReview';
import { decodeImportUtf8, parseTextImport } from '../../import/textImportParser';
import type { ImportMode, ImportParseResult } from '../../import/importTypes';
import { pickImportTable, pickImportTxt } from '../../import/importPlatform';
import { cleanupImportScreenshotCopies, MAX_SCREENSHOT_IMPORT_PAGES, pickImportScreenshots } from '../../import/screenshotImportPlatform';
import { applyScreenshotOcrResult, recognizeScreenshotBatch } from '../../import/screenshotImportOcr';
import { createScreenshotDraft, moveScreenshot, removeScreenshot, resetScreenshotForRetry, setScreenshotContinuation, updateScreenshotText, type ScreenshotImportDraft } from '../../import/screenshotImportDraft';
import { parseScreenshotImport } from '../../import/screenshotImportParser';
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
  const [screenshotDraft, setScreenshotDraft] = useState<ScreenshotImportDraft | null>(null);
  const [screenshotError, setScreenshotError] = useState('');
  const screenshotId = useRef(0);
  const screenshotRun = useRef(0);

  async function buildReview(result: ImportParseResult) {
    const existingBooks = await books.list();
    const existingNotes = (await Promise.all(existingBooks.map(book => notes.listNotes(book.id)))).flat();
    const next: ImportReview = {
      items: result.candidates.map(candidate => ({ candidate, action: 'create', targetBookId: null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] })),
      fragments: result.fragments, fragmentDecisions: {}, warnings: result.warnings,
    };
    setReview(next);
    setHints(findImportDuplicates(next, existingBooks.map(book => ({ id: book.id, title: book.title, author: book.author })), existingNotes.map(note => ({ id: note.id, bookId: note.bookId, body: note.body }))));
  }

  function nextScreenshotId(): string { screenshotId.current += 1; return `page-${screenshotId.current}`; }

  function recognizeScreenshots(pages: ScreenshotImportDraft['pages']) {
    const run = ++screenshotRun.current;
    const recognizer = getLocalImageTextRecognizer();
    void recognizeScreenshotBatch(pages, recognizer, (pageId, revision, result) => {
      setScreenshotDraft(current => current ? applyScreenshotOcrResult(current, pageId, revision, result) : current);
    }, () => screenshotRun.current !== run);
  }

  async function chooseScreenshots() {
    setScreenshotError('');
    try {
      const uris = await pickImportScreenshots();
      if (!uris) return;
      if (uris.length === 0) throw new Error('没有选择图片');
      if (screenshotDraft && screenshotDraft.pages.length + uris.length > MAX_SCREENSHOT_IMPORT_PAGES) throw new Error(`一次最多处理 ${MAX_SCREENSHOT_IMPORT_PAGES} 张截图`);
      const picked = createScreenshotDraft(uris, nextScreenshotId);
      if (!screenshotDraft) {
        setReview(null);
        setScreenshotDraft(picked);
        recognizeScreenshots(picked.pages);
      } else {
        const next = { ...screenshotDraft, pages: [...screenshotDraft.pages, ...picked.pages], parseRevision: screenshotDraft.parseRevision + 1 };
        setReview(null);
        setScreenshotDraft(next);
        recognizeScreenshots(picked.pages);
      }
    } catch (cause) { setScreenshotError(cause instanceof Error ? cause.message : '选择截图失败'); }
  }

  function changeScreenshot(next: ScreenshotImportDraft) { setReview(null); setScreenshotError(''); setScreenshotDraft(next); }

  function retryScreenshot(pageId: string) {
    const current = screenshotDraft;
    const page = current?.pages.find(entry => entry.id === pageId);
    if (!current || !page) return;
    const retry = () => {
      const next = resetScreenshotForRetry(current, pageId);
      setReview(null); setScreenshotError(''); setScreenshotDraft(next);
      recognizeScreenshots(next.pages.filter(entry => entry.id === pageId));
    };
    if (page.edited) Alert.alert('确认重新识别', '这会清空这张图的手工文字并用新的识别结果替换。', [{ text: '取消', style: 'cancel' }, { text: '继续识别', onPress: retry }]);
    else retry();
  }

  async function parseScreenshots() {
    if (!screenshotDraft) return;
    setScreenshotError('');
    try { await buildReview(parseScreenshotImport(screenshotDraft.pages, mode, defaultStatus)); }
    catch (cause) { setScreenshotError(cause instanceof Error ? cause.message : '无法解析截图文字'); }
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
    setReview({ items: [{ candidate, action: 'create', targetBookId: null, acknowledgedDuplicateBookIds: [], acknowledgedDuplicateNoteIds: [] }], fragments: [], fragmentDecisions: {} });
    setHints([]);
  }

  async function confirm() {
    if (!review || busy) return;
    setBusy(true); setError('');
    try { await service.commit(review); await cleanupImportScreenshotCopies(screenshotDraft?.pages.map(page => page.uri) ?? []); setScreenshotDraft(null); router.replace('/'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : '导入失败，请检查预览后重试'); }
    finally { setBusy(false); }
  }

  if (review) return <ImportReviewList review={review} hints={hints} busy={busy} onChange={setReview} onConfirm={() => { void confirm(); }} onCancel={() => { if (!busy) setReview(null); }} />;
  if (screenshotDraft) return <ScreenshotImportSource draft={screenshotDraft} done={screenshotDraft.pages.filter(page => page.ocrState !== 'pending').length} total={screenshotDraft.pages.length} error={screenshotError} onPick={() => { void chooseScreenshots(); }} onMove={(from, to) => changeScreenshot(moveScreenshot(screenshotDraft, from, to))} onRemove={pageId => { const page = screenshotDraft.pages.find(entry => entry.id === pageId); if (page) void cleanupImportScreenshotCopies([page.uri]); changeScreenshot(removeScreenshot(screenshotDraft, pageId)); }} onRetry={retryScreenshot} onTextChange={(pageId, value) => changeScreenshot(updateScreenshotText(screenshotDraft, pageId, value))} onContinuationChange={(pageId, value) => changeScreenshot(setScreenshotContinuation(screenshotDraft, pageId, value))} onParse={() => { void parseScreenshots(); }} />;
  if (tableStep === 'sheet') return <TableImportSource fileName={tableFileName} sheets={tableSheets} onSelect={index => { setTableSheetIndex(index); setTableStep('mapping'); }} onCancel={() => { setTableStep('source'); setTableSheets([]); }} />;
  if (tableStep === 'mapping' && tableSheets[tableSheetIndex]) return <TableImportMapping sheet={tableSheets[tableSheetIndex]} defaultStatus={defaultStatus} tagIdsByName={availableTags} onMapped={result => { setTableStep('source'); void buildReview(result); }} onBack={() => { setTableStep(tableSheets.length > 1 ? 'sheet' : 'source'); }} />;
  return <ImportSourceForm text={text} mode={mode} defaultStatus={defaultStatus} error={error} tableDelimiter={tableDelimiter} onTableDelimiterChange={setTableDelimiter} onTextChange={setText} onModeChange={setMode} onStatusChange={setDefaultStatus} onPickFile={() => { void pickFile(); }} onPickScreenshots={() => { void chooseScreenshots(); }} onPickTable={() => { void pickTable(); }} onParse={() => { void parse(); }} onManualCandidate={manualCandidate} />;
}
