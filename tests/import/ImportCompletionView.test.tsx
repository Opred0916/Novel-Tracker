import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ImportCompletionView } from '../../src/import/ImportCompletionView';
import type { ImportSummary } from '../../src/import/importReview';

jest.mock('../../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { primary: '#28584E', primarySoft: '#E8F1EC', card: '#FFFFFF', text: '#292D29', border: '#D8D5CD', mutedText: '#716F68', background: '#F6F3EC' } }),
}));

const summary: ImportSummary = { createdBooks: 2, createdNotes: 3, appendedNotes: 1, skippedItems: 1, createdSessions: 2, appendedBookCount: 1, rereadSessions: 1, fiveStarBooks: 1, earliestRecordedOn: '2025-04-02' };

test('shows the committed import stats and actions', async () => {
  const onBookshelf = jest.fn();
  const onRecap = jest.fn();
  const screen = await render(<ImportCompletionView summary={summary} onBookshelf={onBookshelf} onAnnualRecap={onRecap} />);
  expect(screen.getByText('导入完成')).toBeTruthy();
  expect(screen.getByText('新增小说 2 本')).toBeTruthy();
  expect(screen.getByText('新增阅读记录 2 条')).toBeTruthy();
  expect(screen.getByText('最早记录日期：2025-04-02')).toBeTruthy();
  fireEvent.press(screen.getByText('打开书库'));
  fireEvent.press(screen.getByText('查看年度回顾'));
  expect(onBookshelf).toHaveBeenCalled();
  expect(onRecap).toHaveBeenCalled();
});
