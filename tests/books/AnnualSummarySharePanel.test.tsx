import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AnnualSummarySharePanel } from '../../src/books/AnnualSummarySharePanel';
import type { AnnualStorySummary, AnnualSummaryBook } from '../../src/books/annualSummaryRepository';
import { captureRecapPng, discardRecapPng, saveRecapPng, shareRecapPng } from '../../src/books/recapSharePlatform';

jest.mock('../../src/books/recapSharePlatform', () => ({
  captureRecapPng: jest.fn(), saveRecapPng: jest.fn(), shareRecapPng: jest.fn(), discardRecapPng: jest.fn(),
}));
jest.mock('../../src/books/AnnualSummaryPoster', () => ({
  AnnualSummaryPoster: require('react').forwardRef(function MockPoster({ snapshot, onReady }: { snapshot: { privacy: { showTitles: boolean; showCovers: boolean; showArchiveStats: boolean } }; onReady(value: boolean): void }, _ref: unknown) {
    const React = require('react');
    const { Text, View } = require('react-native');
    return <View ref={_ref}>
      <Text>{`预览:${snapshot.privacy.showTitles}:${snapshot.privacy.showCovers}:${snapshot.privacy.showArchiveStats}`}</Text>
      <Text accessibilityRole="button" onPress={() => onReady(true)}>标记海报就绪</Text>
    </View>;
  }),
}));

function book(): AnnualSummaryBook {
  return { bookId: 'a', title: '长夜', author: null, coverUri: null, bookType: null, tags: [], ratingHalfStars: 10, firstFinishedOn: '2026-01-01', lastFinishedOn: '2026-01-01', rereadCompletionCount: 0, annualThoughtCount: 1, annualThoughtImageCount: 0, currentHighlightCount: 1 };
}

function summary(year = 2026): AnnualStorySummary {
  const item = book();
  return { year, booksReadCount: 1, books: [item], coverBooks: [item], firstBook: item, lastBook: item, months: [], peakMonths: [], topTags: [], topBookTypes: [], topAuthors: [], highestRatingHalfStars: 10, topRatedBooks: [item], fiveStarBookCount: 1, thoughtCount: 1, thoughtBookCount: 1, thoughtImageCount: 0, currentHighlightCount: 1, mostThoughtBooks: [], rereadBooks: [], representativeBooks: [item] };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(captureRecapPng).mockResolvedValue('file:///annual.png');
  jest.mocked(saveRecapPng).mockResolvedValue(undefined);
  jest.mocked(shareRecapPng).mockResolvedValue(undefined);
});

test('privacy_switches_are_independent_and_reset_for_another_year', async () => {
  const screen = await render(<AnnualSummarySharePanel summary={summary()} />);
  expect(screen.getByText('预览:true:true:true')).toBeTruthy();
  await fireEvent.press(screen.getByRole('switch', { name: '显示书名' }));
  expect(screen.getByText('预览:false:true:true')).toBeTruthy();
  await fireEvent.press(screen.getByRole('switch', { name: '显示封面' }));
  expect(screen.getByText('预览:false:false:true')).toBeTruthy();
  await screen.rerender(<AnnualSummarySharePanel summary={summary(2025)} />);
  expect(screen.getByText('预览:true:true:true')).toBeTruthy();
});

test('waits_for_poster_blocks_duplicate_save_and_always_discards_the_file', async () => {
  let resolveSave!: () => void;
  jest.mocked(saveRecapPng).mockReturnValueOnce(new Promise<void>(resolve => { resolveSave = resolve; }));
  const screen = await render(<AnnualSummarySharePanel summary={summary()} />);
  expect(screen.getByRole('button', { name: '保存到相册' }).props.accessibilityState).toEqual({ disabled: true });
  await fireEvent.press(screen.getByText('标记海报就绪'));
  await fireEvent.press(screen.getByRole('button', { name: '保存到相册' }));
  await fireEvent.press(screen.getByRole('button', { name: '保存到相册' }));
  expect(captureRecapPng).toHaveBeenCalledTimes(1);
  await act(async () => { resolveSave(); });
  await waitFor(() => expect(screen.getByText('已保存到相册')).toBeTruthy());
  expect(discardRecapPng).toHaveBeenCalledWith('file:///annual.png');
});

test('keeps_save_and_share_failures_independent_with_precise_copy', async () => {
  jest.mocked(saveRecapPng).mockRejectedValueOnce({ code: 'permission_denied' });
  jest.mocked(shareRecapPng).mockRejectedValueOnce({ code: 'unavailable' }).mockResolvedValueOnce(undefined);
  const screen = await render(<AnnualSummarySharePanel summary={summary()} />);
  await fireEvent.press(screen.getByText('标记海报就绪'));
  await fireEvent.press(screen.getByRole('button', { name: '保存到相册' }));
  await waitFor(() => expect(screen.getByText('未获得相册写入权限，可以改用系统分享')).toBeTruthy());
  expect(screen.getByRole('button', { name: '系统分享' }).props.accessibilityState).toEqual({ disabled: false });
  await fireEvent.press(screen.getByRole('button', { name: '系统分享' }));
  await waitFor(() => expect(screen.getByText('这台设备暂时无法使用系统分享')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: '系统分享' }));
  await waitFor(() => expect(screen.getByText('系统分享面板已关闭')).toBeTruthy());
  expect(discardRecapPng).toHaveBeenCalledTimes(3);
});

test('does_not_update_state_after_unmount_but_still_discards_capture', async () => {
  let resolveCapture!: (uri: string) => void;
  jest.mocked(captureRecapPng).mockReturnValueOnce(new Promise(resolve => { resolveCapture = resolve; }));
  const screen = await render(<AnnualSummarySharePanel summary={summary()} />);
  await fireEvent.press(screen.getByText('标记海报就绪'));
  await fireEvent.press(screen.getByRole('button', { name: '系统分享' }));
  await screen.unmount();
  await act(async () => { resolveCapture('file:///late.png'); });
  await waitFor(() => expect(discardRecapPng).toHaveBeenCalledWith('file:///late.png'));
  expect(shareRecapPng).not.toHaveBeenCalled();
});
