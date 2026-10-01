import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { BookEditForm } from '../../src/books/BookEditForm';
import type { Book } from '../../src/books/types';
import { todayLocalDate } from '../../src/books/readingDates';

const baseBook: Book = {
  id: 'book-1', title: '长夜', author: null, status: 'want_to_read', protagonists: [], ratingHalfStars: null, bookType: null, tags: [],
  legacyReadCount: 0, createdAt: '2026-09-29T10:00:00.000Z', updatedAt: '2026-09-29T10:00:00.000Z',
};

test('edits a work type and tags from the full library', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const tags = [
    { id: 'ancient', name: '古代', isSystem: true },
    { id: 'suspense', name: '悬疑', isSystem: true },
  ];
  const screen = await render(<BookEditForm book={{ ...baseBook, tags: [tags[0]] }} onSave={onSave} allTags={tags} />);
  await fireEvent.press(screen.getByText('GL'));
  await fireEvent.changeText(screen.getByPlaceholderText('搜索标签'), '悬疑');
  await fireEvent.press(screen.getByText('悬疑'));
  await fireEvent.press(screen.getByText('保存修改'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    bookType: 'romance_female_female', tagIds: ['ancient', 'suspense'],
  })));
});

test('starts with two blank protagonist inputs when the book has none', async () => {
  const screen = await render(<BookEditForm book={baseBook} onSave={async () => {}} />);
  expect(screen.getAllByPlaceholderText('主角名字')).toHaveLength(2);
  expect(screen.getByDisplayValue('长夜')).toBeTruthy();
});

test('allows editing lower protagonist fields above the iPhone keyboard', async () => {
  const screen = await render(<BookEditForm book={baseBook} onSave={async () => {}} />);
  const scroll = screen.root;
  expect(scroll).not.toBeNull();
  expect(scroll?.props.automaticallyAdjustKeyboardInsets).toBe(true);
});

test('shows every existing protagonist when there are more than two', async () => {
  const book = { ...baseBook, protagonists: ['阿青', '李四', '王五'] };
  const screen = await render(<BookEditForm book={book} onSave={async () => {}} />);
  expect(screen.getAllByPlaceholderText('主角名字')).toHaveLength(3);
  expect(screen.getByDisplayValue('王五')).toBeTruthy();
});

test('adds another protagonist and sends trimmed, ordered names with the chosen status', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<BookEditForm book={baseBook} onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('作者名字'), ' 某作者 ');
  await fireEvent.changeText(screen.getAllByPlaceholderText('主角名字')[0], ' 阿青 ');
  await fireEvent.press(screen.getByText('＋ 添加主角'));
  expect(screen.getAllByPlaceholderText('主角名字')).toHaveLength(3);
  await fireEvent.changeText(screen.getAllByPlaceholderText('主角名字')[2], ' 王五 ');
  await fireEvent.press(screen.getByText('在读'));
  await fireEvent.press(screen.getByText('保存修改'));

  await waitFor(() => expect(onSave).toHaveBeenCalledWith({
    title: '长夜', author: '某作者', status: 'reading', protagonists: ['阿青', '王五'], ratingHalfStars: null, bookType: null, tagIds: [],
    readingDates: { startedOn: todayLocalDate(), endedOn: null },
  }));
});

test('keeps an existing rating when a finished book becomes reading', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<BookEditForm book={{ ...baseBook, status: 'finished', ratingHalfStars: 9 }} onSave={onSave} />);
  await fireEvent.press(screen.getByText('在读'));
  expect(screen.getByText('4.5 / 5 星')).toBeTruthy();
  expect(screen.queryByTestId('rating-slider')).toBeNull();
  await fireEvent.press(screen.getByText('保存修改'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    status: 'reading', ratingHalfStars: 9,
  })));
});

test('does not submit an uncommitted new rating after leaving finished status', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<BookEditForm book={{ ...baseBook, status: 'finished', ratingHalfStars: 9 }} onSave={onSave} />);
  await fireEvent(screen.getByTestId('rating-slider'), 'valueChange', 5);
  await fireEvent.press(screen.getByText('在读'));
  await fireEvent.press(screen.getByText('保存修改'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    status: 'reading', ratingHalfStars: 9,
  })));
});

test('can clear an existing rating while rereading', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<BookEditForm book={{ ...baseBook, status: 'reading', ratingHalfStars: 9 }} onSave={onSave} />);
  await fireEvent.press(screen.getByText('清除评分'));
  await fireEvent.press(screen.getByText('保存修改'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ ratingHalfStars: null })));
});

test('can score a book after changing its status to finished', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<BookEditForm book={baseBook} onSave={onSave} />);
  await fireEvent.press(screen.getByText('读完'));
  await fireEvent(screen.getByTestId('rating-slider'), 'valueChange', 4.5);
  await fireEvent.press(screen.getByText('保存修改'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    status: 'finished', ratingHalfStars: 9,
  })));
});

test('previews the next reading number and uses its edited start date', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<BookEditForm book={{ ...baseBook, status: 'finished', legacyReadCount: 1 }} onSave={onSave} sessions={[]} />);
  await fireEvent.press(screen.getByText('在读'));
  expect(screen.getByText(/第 2 次阅读/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('开始日期'), '2026-09-01');
  await fireEvent.press(screen.getByText('保存修改'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    readingDates: { startedOn: '2026-09-01', endedOn: null },
  })));
});

test('finishes an active record with its original start date and editable end date', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<BookEditForm book={{ ...baseBook, status: 'reading' }} onSave={onSave} sessions={[
    { id: 'first', bookId: baseBook.id, ordinal: 1, startedOn: '2026-09-01', endedOn: null, outcome: 'reading' },
  ]} />);
  await fireEvent.press(screen.getByText('弃读'));
  expect(screen.getByDisplayValue('2026-09-01')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('结束日期'), '2026-09-15');
  await fireEvent.press(screen.getByText('保存修改'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    readingDates: { startedOn: '2026-09-01', endedOn: '2026-09-15' },
  })));
});

test('asks before cancelling an active reading and only saves after confirmation', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const onSave = jest.fn().mockResolvedValue(undefined);
  try {
    const screen = await render(<BookEditForm book={{ ...baseBook, status: 'reading' }} onSave={onSave} sessions={[
      { id: 'first', bookId: baseBook.id, ordinal: 1, startedOn: '2026-09-01', endedOn: null, outcome: 'reading' },
    ]} />);
    await fireEvent.press(screen.getByText('想读'));
    await fireEvent.press(screen.getByText('保存修改'));
    expect(onSave).not.toHaveBeenCalled();
    expect(alert).toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2];
    await act(async () => { buttons?.[0]?.onPress?.(); });
    expect(onSave).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('保存修改'));
    await act(async () => { buttons?.[1]?.onPress?.(); });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  } finally { alert.mockRestore(); }
});

test('keeps the form open and shows an error for a blank title', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<BookEditForm book={baseBook} onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '   ');
  await fireEvent.press(screen.getByText('保存修改'));
  expect(screen.getByText('请输入书名')).toBeTruthy();
  expect(onSave).not.toHaveBeenCalled();
});

test('retains entered values after save failure and allows retry', async () => {
  const onSave = jest.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(undefined);
  const screen = await render(<BookEditForm book={baseBook} onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '新长夜');
  await fireEvent.changeText(screen.getAllByPlaceholderText('主角名字')[0], '阿青');
  await fireEvent.press(screen.getByText('保存修改'));
  await waitFor(() => expect(screen.getByText('保存失败，请重试')).toBeTruthy());
  expect(screen.getByDisplayValue('新长夜')).toBeTruthy();
  expect(screen.getByDisplayValue('阿青')).toBeTruthy();

  await fireEvent.press(screen.getByText('保存修改'));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
});

test('does not submit twice while an edit is being saved', async () => {
  let finishSave: () => void = () => {};
  const onSave = jest.fn(() => new Promise<void>(resolve => { finishSave = resolve; }));
  const screen = await render(<BookEditForm book={baseBook} onSave={onSave} />);
  let fiber = screen.getByRole('button', { name: '保存修改' }).unstable_fiber;
  let save: (() => Promise<void>) | undefined;
  while (fiber && !save) {
    save = fiber.memoizedProps?.onPress as (() => Promise<void>) | undefined;
    fiber = fiber.return;
  }
  expect(save).toBeDefined();
  await act(async () => {
    const firstPress = save!();
    const secondPress = save!();
    expect(onSave).toHaveBeenCalledTimes(1);
    finishSave();
    await Promise.all([firstPress, secondPress]);
  });
});
