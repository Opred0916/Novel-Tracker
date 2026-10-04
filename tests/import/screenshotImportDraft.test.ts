import {
  createScreenshotDraft,
  moveScreenshot,
  removeScreenshot,
  resetScreenshotForRetry,
  setScreenshotContinuation,
  updateScreenshotText,
} from '../../src/import/screenshotImportDraft';

function draft() {
  return createScreenshotDraft(['file:///one.png', 'file:///two.png'], (() => {
    let index = 0;
    return () => `page-${++index}`;
  })());
}

test('creates ordered pages with stable ids and no first-page continuation', () => {
  const result = draft();
  expect(result.pages.map(page => page.uri)).toEqual(['file:///one.png', 'file:///two.png']);
  expect(result.pages.map(page => page.id)).toEqual(['page-1', 'page-2']);
  expect(result.pages.every(page => page.ocrState === 'pending' && !page.continuesPrevious)).toBe(true);
  expect(result.parseRevision).toBe(0);
});

test('invalidates the parse revision when order, text, or continuation changes', () => {
  const initial = draft();
  const moved = moveScreenshot(initial, 1, 0);
  expect(moved.pages.map(page => page.uri)).toEqual(['file:///two.png', 'file:///one.png']);
  expect(moved.parseRevision).toBe(1);
  const continued = setScreenshotContinuation(moved, 'page-1', true);
  expect(continued.pages[0].continuesPrevious).toBe(false);
  const second = setScreenshotContinuation(continued, 'page-2', true);
  expect(second.pages[1].continuesPrevious).toBe(true);
  const edited = updateScreenshotText(second, 'page-2', '修正后的文字');
  expect(edited.pages.find(page => page.id === 'page-2')).toMatchObject({ text: '修正后的文字', edited: true, ocrState: 'manual' });
  expect(edited.parseRevision).toBe(3);
});

test('removing a page invalidates the draft without changing the other page', () => {
  const result = removeScreenshot(draft(), 'page-1');
  expect(result.pages).toHaveLength(1);
  expect(result.pages[0]).toMatchObject({ id: 'page-2', uri: 'file:///two.png', continuesPrevious: false });
  expect(result.parseRevision).toBe(1);
});

test('prepares a manually edited page for an explicit OCR retry without touching other pages', () => {
  const edited = updateScreenshotText(draft(), 'page-1', '手动文字');
  const retried = resetScreenshotForRetry(edited, 'page-1');

  expect(retried.pages[0]).toMatchObject({ text: '', edited: false, ocrState: 'pending', revision: 2 });
  expect(retried.pages[1]).toMatchObject({ text: '', edited: false, ocrState: 'pending', revision: 0 });
  expect(retried.parseRevision).toBe(2);
});
