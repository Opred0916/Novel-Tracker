export type ScreenshotOcrState = 'pending' | 'recognized' | 'empty' | 'failed' | 'unavailable' | 'manual';

export type ScreenshotPageDraft = {
  id: string;
  uri: string;
  text: string;
  ocrState: ScreenshotOcrState;
  edited: boolean;
  continuesPrevious: boolean;
  revision: number;
};

export type ScreenshotImportDraft = {
  pages: ScreenshotPageDraft[];
  parseRevision: number;
};

function changed(draft: ScreenshotImportDraft, pages: ScreenshotPageDraft[]): ScreenshotImportDraft {
  return { pages, parseRevision: draft.parseRevision + 1 };
}

export function createScreenshotDraft(uris: string[], idFactory: () => string): ScreenshotImportDraft {
  return {
    pages: uris.map(uri => ({ id: idFactory(), uri, text: '', ocrState: 'pending', edited: false, continuesPrevious: false, revision: 0 })),
    parseRevision: 0,
  };
}

export function moveScreenshot(draft: ScreenshotImportDraft, from: number, to: number): ScreenshotImportDraft {
  if (from === to || from < 0 || to < 0 || from >= draft.pages.length || to >= draft.pages.length) return draft;
  const pages = [...draft.pages];
  const [page] = pages.splice(from, 1);
  pages.splice(to, 0, page);
  pages[0] = { ...pages[0], continuesPrevious: false };
  return changed(draft, pages);
}

export function removeScreenshot(draft: ScreenshotImportDraft, pageId: string): ScreenshotImportDraft {
  if (!draft.pages.some(page => page.id === pageId)) return draft;
  const pages = draft.pages.filter(page => page.id !== pageId);
  if (pages[0]) pages[0] = { ...pages[0], continuesPrevious: false };
  return changed(draft, pages);
}

export function updateScreenshotText(draft: ScreenshotImportDraft, pageId: string, text: string): ScreenshotImportDraft {
  const index = draft.pages.findIndex(page => page.id === pageId);
  if (index < 0 || draft.pages[index].text === text && draft.pages[index].edited) return draft;
  const pages = [...draft.pages];
  pages[index] = { ...pages[index], text, edited: true, ocrState: 'manual', revision: pages[index].revision + 1 };
  return changed(draft, pages);
}

export function setScreenshotContinuation(draft: ScreenshotImportDraft, pageId: string, value: boolean): ScreenshotImportDraft {
  const index = draft.pages.findIndex(page => page.id === pageId);
  if (index <= 0 || draft.pages[index].continuesPrevious === value) return draft;
  const pages = [...draft.pages];
  pages[index] = { ...pages[index], continuesPrevious: value };
  return changed(draft, pages);
}

export function applyScreenshotOcrResult(draft: ScreenshotImportDraft, pageId: string, revision: number, result: { text?: string; error?: string }): ScreenshotImportDraft {
  const index = draft.pages.findIndex(page => page.id === pageId);
  if (index < 0) return draft;
  const page = draft.pages[index];
  if (page.revision !== revision || page.edited) return draft;

  const text = result.text ?? '';
  const ocrState = result.error
    ? result.error === '本地图片文字识别不可用' ? 'unavailable' : 'failed'
    : text.trim() ? 'recognized' : 'empty';
  const pages = [...draft.pages];
  pages[index] = { ...page, text, ocrState };
  return changed(draft, pages);
}
