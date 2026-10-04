import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ImagePreview } from '../../src/books/ImagePreview';

const image = { id: 'image-1', bookId: 'book-1', localPath: 'file:///one.jpg', createdAt: '2026-03-01' };

test('shows the selected image and allows closing the preview', async () => {
  const onClose = jest.fn();
  const screen = await render(<ImagePreview image={image} visible onClose={onClose} status="recognized" recognizedText="命中的图片文字" />);
  expect(screen.getByLabelText('精彩片段预览')).toBeTruthy();
  expect(screen.getByText('图片文字')).toBeTruthy();
  expect(screen.getByText('命中的图片文字')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('关闭图片预览'));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('offers retry when local recognition failed', async () => {
  const onRetry = jest.fn();
  const screen = await render(<ImagePreview image={image} visible onClose={jest.fn()} status="failed" onRetry={onRetry} />);
  expect(screen.getByText('图片文字识别失败')).toBeTruthy();
  await fireEvent.press(screen.getByText('重试识别'));
  expect(onRetry).toHaveBeenCalledTimes(1);
});

test.each([
  ['pending', '等待识别图片文字'],
  ['processing', '正在识别图片文字…'],
  ['empty', '未识别到文字'],
  ['unavailable', '当前版本暂不支持本地图片文字识别'],
] as const)('shows %s recognition status', async (status, label) => {
  const screen = await render(<ImagePreview image={image} visible onClose={jest.fn()} status={status} />);
  expect(screen.getByText(label)).toBeTruthy();
});
