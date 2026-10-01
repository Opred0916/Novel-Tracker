import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { AddBookForm } from '../../src/books/AddBookForm';
import { todayLocalDate } from '../../src/books/readingDates';

test('adds work type and quick tags to a new novel', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const quickTags = [
    { id: 'ancient', name: '古代', isSystem: true },
    { id: 'suspense', name: '悬疑', isSystem: true },
  ];
  const screen = await render(<AddBookForm onSave={onSave} quickTags={quickTags} />);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '长夜');
  await fireEvent.press(screen.getByText('耽美'));
  await fireEvent.press(screen.getByText('古代'));
  await fireEvent.press(screen.getByText('悬疑'));
  await fireEvent.press(screen.getByText('保存小说'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    bookType: 'romance_male_male', tagIds: ['ancient', 'suspense'],
  })));
});

test('adds a novel with only its title', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<AddBookForm onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '  长夜  ');
  await fireEvent.press(screen.getByText('保存小说'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({
    title: '长夜', author: null, status: 'want_to_read', protagonists: [], ratingHalfStars: null, bookType: null, tagIds: [],
  }));
});

test('allows the form to scroll above the iPhone keyboard', async () => {
  const screen = await render(<AddBookForm onSave={async () => {}} />);
  const scroll = screen.root;
  expect(scroll).not.toBeNull();
  expect(scroll?.props.automaticallyAdjustKeyboardInsets).toBe(true);
});

test('adds a finished novel with author, ordered protagonists and 4.5 stars', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<AddBookForm onSave={onSave} />);
  expect(screen.getAllByPlaceholderText('主角名字')).toHaveLength(2);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), ' 长夜 ');
  await fireEvent.changeText(screen.getByPlaceholderText('作者名字'), ' 某作者 ');
  await fireEvent.changeText(screen.getAllByPlaceholderText('主角名字')[0], ' 阿青 ');
  await fireEvent.press(screen.getByText('＋ 添加主角'));
  await fireEvent.changeText(screen.getAllByPlaceholderText('主角名字')[2], ' 李四 ');
  await fireEvent.press(screen.getByText('读完'));
  await fireEvent(screen.getByTestId('rating-slider'), 'valueChange', 4.5);
  await fireEvent.press(screen.getByText('保存小说'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({
    title: '长夜', author: '某作者', status: 'finished',
    protagonists: ['阿青', '李四'], ratingHalfStars: 9, bookType: null, tagIds: [],
    readingDates: { startedOn: todayLocalDate(), endedOn: todayLocalDate() },
  }));
});

test.each([['在读', 'reading'], ['弃读', 'dropped']])('can create a book directly as %s', async (label, status) => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<AddBookForm onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '长夜');
  await fireEvent.press(screen.getByText(label));
  await fireEvent.press(screen.getByText('保存小说'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ status })));
});

test('hides a draft rating outside finished status and restores it when finished is reselected', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<AddBookForm onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '长夜');
  await fireEvent.press(screen.getByText('读完'));
  await fireEvent(screen.getByTestId('rating-slider'), 'valueChange', 4.5);
  await fireEvent.press(screen.getByText('在读'));
  expect(screen.queryByTestId('rating-slider')).toBeNull();
  await fireEvent.press(screen.getByText('保存小说'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    status: 'reading', ratingHalfStars: null,
  })));
  await fireEvent.press(screen.getByText('读完'));
  expect(screen.getByText('4.5 / 5 星')).toBeTruthy();
});

test('submits all details after switching finished to reading and back', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<AddBookForm onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), ' 长夜 ');
  await fireEvent.changeText(screen.getByPlaceholderText('作者名字'), ' 某作者 ');
  await fireEvent.changeText(screen.getAllByPlaceholderText('主角名字')[0], ' 阿青 ');
  await fireEvent.changeText(screen.getAllByPlaceholderText('主角名字')[1], ' 李四 ');
  await fireEvent.press(screen.getByText('读完'));
  await fireEvent(screen.getByTestId('rating-slider'), 'valueChange', 4.5);
  await fireEvent.press(screen.getByText('在读'));
  await fireEvent.press(screen.getByText('读完'));
  await fireEvent.press(screen.getByText('保存小说'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({
    title: '长夜', author: '某作者', status: 'finished',
    protagonists: ['阿青', '李四'], ratingHalfStars: 9, bookType: null, tagIds: [],
    readingDates: { startedOn: todayLocalDate(), endedOn: todayLocalDate() },
  }));
});

test('rejects a blank title without submitting', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<AddBookForm onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '   ');
  await fireEvent.press(screen.getByText('保存小说'));
  expect(screen.getByText('请输入书名')).toBeTruthy();
  expect(onSave).not.toHaveBeenCalled();
});

test('allows editing both dates before creating a finished book and keeps invalid dates visible', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<AddBookForm onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '长夜');
  await fireEvent.press(screen.getByText('读完'));
  expect(screen.getAllByDisplayValue(todayLocalDate())).toHaveLength(2);
  await fireEvent.changeText(screen.getByLabelText('开始日期'), '2026-02-30');
  await fireEvent.changeText(screen.getByLabelText('结束日期'), '2026-03-01');
  await fireEvent.press(screen.getByText('保存小说'));
  expect(onSave).not.toHaveBeenCalled();
  expect(screen.getByDisplayValue('2026-02-30')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('开始日期'), '2026-02-28');
  await fireEvent.press(screen.getByText('保存小说'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    readingDates: { startedOn: '2026-02-28', endedOn: '2026-03-01' },
  })));
});

test('keeps all details after a save failure and allows retry', async () => {
  const onSave = jest.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValueOnce(undefined);
  const screen = await render(<AddBookForm onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '长夜');
  await fireEvent.changeText(screen.getByPlaceholderText('作者名字'), '某作者');
  await fireEvent.changeText(screen.getAllByPlaceholderText('主角名字')[0], '阿青');
  await fireEvent.press(screen.getByText('读完'));
  await fireEvent(screen.getByTestId('rating-slider'), 'valueChange', 4.5);
  await fireEvent.press(screen.getByText('保存小说'));
  await waitFor(() => expect(screen.getByText('保存失败，请重试')).toBeTruthy());
  expect(screen.getByDisplayValue('某作者')).toBeTruthy();
  expect(screen.getByDisplayValue('阿青')).toBeTruthy();
  expect(screen.getByText('4.5 / 5 星')).toBeTruthy();
  await fireEvent.press(screen.getByText('保存小说'));
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
});

test('does not submit twice while a new book is being saved', async () => {
  let finishSave: () => void = () => {};
  const onSave = jest.fn(() => new Promise<void>(resolve => { finishSave = resolve; }));
  const screen = await render(<AddBookForm onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '长夜');
  let fiber = screen.getByRole('button', { name: '保存小说' }).unstable_fiber;
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
