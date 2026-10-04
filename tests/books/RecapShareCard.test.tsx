import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { RecapShareCard } from '../../src/books/RecapShareCard';
import type { RecapShareSnapshot } from '../../src/books/recapShareSnapshot';
import { makeRecapShareSnapshot } from '../../src/books/recapShareSnapshot';
import { THEMES } from '../../src/theme/theme';

const snapshot = makeRecapShareSnapshot({ year: 2026, rereadSuccess: [], dropped: [], fiveStar: [
  { bookId: 'a', title: '无封面书', coverUri: null, ratingHalfStars: 10, sessions: [{ id: '1', ordinal: 1, outcome: 'finished', startedOn: null, endedOn: '2026-01-01' }] },
  { bookId: 'b', title: '真实封面书', coverUri: 'file:///cover.jpg', ratingHalfStars: 10, sessions: [{ id: '2', ordinal: 1, outcome: 'finished', startedOn: null, endedOn: '2026-02-01' }] },
] }, 'fiveStar', THEMES.forest) as RecapShareSnapshot;

test('renders only the export card and waits for real cover', async () => {
  const onReady = jest.fn();
  const screen = await render(<RecapShareCard snapshot={snapshot} onReady={onReady} />);
  expect(screen.getByText('2026 年')).toBeTruthy();
  expect(screen.getByLabelText('无封面书默认封面')).toBeTruthy();
  expect(screen.queryByText('分享前请确认')).toBeNull();
  expect(onReady).not.toHaveBeenCalledWith(true);
  fireEvent(screen.getByLabelText('真实封面书封面'), 'loadEnd');
  await waitFor(() => expect(onReady).toHaveBeenCalledWith(true));
});

test('failed cover falls back and becomes ready', async () => {
  const onReady = jest.fn();
  const screen = await render(<RecapShareCard snapshot={snapshot} onReady={onReady} />);
  fireEvent(screen.getByLabelText('真实封面书封面'), 'error');
  await waitFor(() => expect(screen.getByLabelText('真实封面书默认封面')).toBeTruthy());
  expect(onReady).toHaveBeenCalledWith(true);
});
