import type { LocalImageTextRecognizer } from '../books/localImageTextRecognizer';
import type { ScreenshotPageDraft, ScreenshotImportDraft } from './screenshotImportDraft';
import { applyScreenshotOcrResult as applyDraftOcrResult } from './screenshotImportDraft';

export async function recognizeScreenshotBatch(
  pages: ScreenshotPageDraft[],
  recognizer: LocalImageTextRecognizer,
  onResult: (pageId: string, revision: number, result: { text?: string; error?: string }) => void,
  shouldStop: () => boolean,
): Promise<void> {
  for (const page of pages) {
    if (shouldStop()) return;
    if (page.edited || page.ocrState === 'manual') continue;
    if (!recognizer.isAvailable()) {
      onResult(page.id, page.revision, { error: '本地图片文字识别不可用' });
      continue;
    }
    try {
      const text = await recognizer.recognize(page.uri);
      onResult(page.id, page.revision, { text });
    } catch (error) {
      onResult(page.id, page.revision, { error: error instanceof Error ? error.message : '识别失败' });
    }
  }
}

export { applyDraftOcrResult as applyScreenshotOcrResult };

export type { ScreenshotImportDraft };
