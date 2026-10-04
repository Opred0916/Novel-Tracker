import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ScreenshotImportSource } from '../../src/import/ScreenshotImportSource';
import { createScreenshotDraft, setScreenshotContinuation } from '../../src/import/screenshotImportDraft';

function draft() {
  return createScreenshotDraft(['file:///one.png', 'file:///two.png'], (() => {
    let index = 0;
    return () => `page-${++index}`;
  })());
}

async function renderSource(overrides: Partial<React.ComponentProps<typeof ScreenshotImportSource>> = {}) {
  const base = {
    draft: draft(),
    done: 1,
    total: 2,
    onPick: jest.fn(),
    onMove: jest.fn(),
    onRemove: jest.fn(),
    onRetry: jest.fn(),
    onTextChange: jest.fn(),
    onContinuationChange: jest.fn(),
    onParse: jest.fn(),
  } satisfies React.ComponentProps<typeof ScreenshotImportSource>;
  const rendered = await render(<ScreenshotImportSource {...base} {...overrides} />);
  return Object.assign(rendered, { callbacks: base });
}

test('shows ordered pages, status, editable multiline text, and manual-input guidance', async () => {
  const sourceDraft = draft();
  sourceDraft.pages[0] = { ...sourceDraft.pages[0], ocrState: 'unavailable' };
  const screen = await renderSource({ draft: sourceDraft });

  expect(screen.getByText('第 1 张')).toBeTruthy();
  expect(screen.getByText('第 2 张')).toBeTruthy();
  expect(screen.getByText('本地识字不可用，可手动输入')).toBeTruthy();
  expect(screen.getAllByText('向上').length).toBeGreaterThan(0);
  expect(screen.getAllByText('删除').length).toBe(2);
  expect(screen.getAllByDisplayValue('')).toHaveLength(2);
});

test('wires reorder, remove, continuation, retry, text, and parse actions', async () => {
  const initial = setScreenshotContinuation(draft(), 'page-2', true);
  const sourceDraft = { ...initial, pages: initial.pages.map((page, index) => index === 0 ? { ...page, ocrState: 'failed' as const } : page) };
  const screen = await renderSource({ draft: sourceDraft });

  await fireEvent.press(screen.getByLabelText('第 2 张上移'));
  await fireEvent.press(screen.getByLabelText('第 2 张删除'));
  await fireEvent.press(screen.getByLabelText('第 2 张取消接上一张'));
  await fireEvent.press(screen.getByLabelText('第 1 张重试识别'));
  await fireEvent.changeText(screen.getByLabelText('第 1 张文字'), '手动文字');
  await fireEvent.press(screen.getByText('生成导入预览'));

  expect(screen.callbacks.onMove).toHaveBeenCalledWith(1, 0);
  expect(screen.callbacks.onRemove).toHaveBeenCalledWith('page-2');
  expect(screen.callbacks.onContinuationChange).toHaveBeenCalledWith('page-2', false);
  expect(screen.callbacks.onRetry).toHaveBeenCalledWith('page-1');
  expect(screen.callbacks.onTextChange).toHaveBeenCalledWith('page-1', '手动文字');
  expect(screen.callbacks.onParse).toHaveBeenCalledTimes(1);
});

test('keeps an existing draft visible when selecting more screenshots is cancelled', async () => {
  const onPick = jest.fn();
  const screen = await renderSource({ onPick });

  await fireEvent.press(screen.getByText('继续选择截图'));

  expect(onPick).toHaveBeenCalledTimes(1);
  expect(screen.getByText('第 1 张')).toBeTruthy();
  expect(screen.getByText('第 2 张')).toBeTruthy();
});
