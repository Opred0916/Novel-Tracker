import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AnnualSummaryPoster } from '../../src/books/AnnualSummaryPoster';
import type { AnnualSummarySnapshot } from '../../src/books/annualSummarySnapshot';
import { THEMES } from '../../src/theme/theme';

const colors = (({ primary, primarySoft, background, card, text, mutedText, border, rating }) => ({ primary, primarySoft, background, card, text, mutedText, border, rating }))(THEMES.forest);
const snapshot: AnnualSummarySnapshot = {
  year: 2026, booksReadCount: 12, tags: ['古代', '强强'], thoughtCount: 8, currentHighlightCount: 15,
  privacy: { showTitles: true, showCovers: true, showArchiveStats: true }, colors,
  books: [
    { bookId: 'a', title: '一部名字很长但仍然需要完整保留在无障碍信息里的小说', coverUri: null },
    { bookId: 'b', title: '真实封面书', coverUri: 'file:///cover.jpg' },
  ],
};

test('renders_branding_main_number_and_waits_for_visible_covers', async () => {
  const onReady = jest.fn();
  const screen = await render(<AnnualSummaryPoster snapshot={snapshot} onReady={onReady} />);
  expect(screen.getByText('我的 2026 阅读回顾')).toBeTruthy();
  expect(screen.getByText('今年读完 12 本小说')).toBeTruthy();
  expect(screen.getByText('由 Novel Tracker 记录')).toBeTruthy();
  expect(onReady).toHaveBeenCalledWith(false);
  await fireEvent(screen.getByLabelText('真实封面书封面'), 'loadEnd');
  await waitFor(() => expect(onReady).toHaveBeenCalledWith(true));
});

test('failed_cover_uses_a_ready_default_cover', async () => {
  const onReady = jest.fn();
  const screen = await render(<AnnualSummaryPoster snapshot={snapshot} onReady={onReady} />);
  await fireEvent(screen.getByLabelText('真实封面书封面'), 'error');
  await waitFor(() => expect(screen.getByLabelText('真实封面书默认封面')).toBeTruthy());
  expect(onReady).toHaveBeenCalledWith(true);
});

test('hidden_titles_covers_and_archive_stats_do_not_render_private_copy', async () => {
  const hidden: AnnualSummarySnapshot = {
    ...snapshot,
    privacy: { showTitles: false, showCovers: false, showArchiveStats: false },
    books: snapshot.books.map(item => ({ ...item, title: '', coverUri: null })),
    thoughtCount: null,
    currentHighlightCount: null,
  };
  const onReady = jest.fn();
  const screen = await render(<AnnualSummaryPoster snapshot={hidden} onReady={onReady} />);
  expect(screen.queryByText('真实封面书')).toBeNull();
  expect(screen.queryByText(/条想法/)).toBeNull();
  expect(screen.queryByText(/精彩片段/)).toBeNull();
  expect(screen.getAllByLabelText('隐藏封面的抽象书脊')).toHaveLength(2);
  expect(onReady).toHaveBeenCalledWith(true);
});
