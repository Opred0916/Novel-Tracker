import { createLocalImageTextRecognizer, type LocalImageTextRecognizer } from '../../src/books/localImageTextRecognizer';
import {
  applyScreenshotOcrResult,
  recognizeScreenshotBatch,
} from '../../src/import/screenshotImportOcr';
import { createScreenshotDraft, updateScreenshotText } from '../../src/import/screenshotImportDraft';

function draft() {
  return createScreenshotDraft(['file:///one.png', 'file:///two.png'], (() => {
    let index = 0;
    return () => `page-${++index}`;
  })());
}

function recognizer(overrides: Partial<LocalImageTextRecognizer> = {}): LocalImageTextRecognizer {
  return {
    isAvailable: () => true,
    recognize: jest.fn(async () => '识别文字'),
    ...overrides,
  };
}

test('recognizes screenshots serially and reports a later failure without losing earlier text', async () => {
  const calls: string[] = [];
  const results: Array<{ pageId: string; revision: number; result: { text?: string; error?: string } }> = [];
  const ocr = recognizer({
    recognize: jest.fn(async (uri: string) => {
      calls.push(uri);
      if (uri.endsWith('two.png')) throw new Error('第二张失败');
      return '第一张文字';
    }),
  });

  await recognizeScreenshotBatch(draft().pages, ocr, (pageId, revision, result) => {
    results.push({ pageId, revision, result });
  }, () => false);

  expect(calls).toEqual(['file:///one.png', 'file:///two.png']);
  expect(results).toEqual([
    { pageId: 'page-1', revision: 0, result: { text: '第一张文字' } },
    { pageId: 'page-2', revision: 0, result: { error: '第二张失败' } },
  ]);
});

test('stops before starting the next screenshot when cancellation is requested', async () => {
  let stop = false;
  const recognize = jest.fn(async () => {
    stop = true;
    return '第一张文字';
  });

  await recognizeScreenshotBatch(draft().pages, recognizer({ recognize }), jest.fn(), () => stop);

  expect(recognize).toHaveBeenCalledTimes(1);
});

test('reports unavailable OCR without trying to call the native recognizer', async () => {
  const recognize = jest.fn();
  const results: Array<{ pageId: string; revision: number; result: { text?: string; error?: string } }> = [];
  const ocr = createLocalImageTextRecognizer(null);

  await recognizeScreenshotBatch(draft().pages, { ...ocr, recognize }, (pageId, revision, result) => {
    results.push({ pageId, revision, result });
  }, () => false);

  expect(recognize).not.toHaveBeenCalled();
  expect(results).toHaveLength(2);
  expect(results[0].result.error).toBe('本地图片文字识别不可用');
});

test('does not let an old OCR result overwrite text edited while recognition was running', () => {
  const initial = draft();
  const edited = updateScreenshotText(initial, 'page-1', '手动修正');

  const result = applyScreenshotOcrResult(edited, 'page-1', initial.pages[0].revision, { text: '旧识别结果' });

  expect(result).toBe(edited);
  expect(result.pages[0]).toMatchObject({ text: '手动修正', edited: true, ocrState: 'manual' });
});

test('applies a current OCR result and marks whitespace as empty', () => {
  const initial = draft();
  const recognized = applyScreenshotOcrResult(initial, 'page-1', 0, { text: '识别结果' });
  const empty = applyScreenshotOcrResult(recognized, 'page-2', 0, { text: '  \n' });

  expect(recognized.pages[0]).toMatchObject({ text: '识别结果', ocrState: 'recognized', edited: false, revision: 0 });
  expect(empty.pages[1]).toMatchObject({ text: '  \n', ocrState: 'empty', edited: false, revision: 0 });
  expect(empty.parseRevision).toBe(2);
});
