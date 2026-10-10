import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import ImportPage from '../../src/app/settings/import';
import { pickImportTxt } from '../../src/import/importPlatform';
import { pickImportScreenshots } from '../../src/import/screenshotImportPlatform';
import { getLocalImageTextRecognizer } from '../../src/books/localImageTextRecognizer';
import { useBooks, useImportCommitService, useNotes, useTags } from '../../src/storage/AppProvider';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() }, Stack: { Screen: () => null } }));
jest.mock('../../src/import/importPlatform', () => ({ pickImportTxt: jest.fn(), pickImportScreenshots: jest.fn() }));
jest.mock('../../src/import/screenshotImportPlatform', () => ({ pickImportScreenshots: jest.fn(), cleanupImportScreenshotCopies: jest.fn() }));
jest.mock('../../src/books/localImageTextRecognizer', () => ({ getLocalImageTextRecognizer: jest.fn() }));
jest.mock('../../src/storage/AppProvider', () => ({ useBooks: jest.fn(), useNotes: jest.fn(), useTags: jest.fn(), useImportCommitService: jest.fn() }));

const books = { list: jest.fn() };
const notes = { listNotes: jest.fn() };
const tags = { list: jest.fn() };
const commitService = { commit: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBooks).mockReturnValue(books as never);
  jest.mocked(useNotes).mockReturnValue(notes as never);
  jest.mocked(useTags).mockReturnValue(tags as never);
  jest.mocked(useImportCommitService).mockReturnValue(commitService as never);
  books.list.mockResolvedValue([]);
  notes.listNotes.mockResolvedValue([]);
  tags.list.mockResolvedValue([]);
  commitService.commit.mockResolvedValue({ createdBooks: 1, createdNotes: 0, appendedNotes: 0, skippedItems: 0, createdSessions: 0, appendedBookCount: 0, rereadSessions: 0, fiveStarBooks: 0, earliestRecordedOn: null });
  jest.mocked(pickImportTxt).mockResolvedValue(null);
  jest.mocked(pickImportScreenshots).mockResolvedValue(null);
  jest.mocked(getLocalImageTextRecognizer).mockReturnValue({ isAvailable: () => false, recognize: jest.fn() });
});

test('uses pasted text and TXT files as the same preview flow', async () => {
  const screen = await render(<ImportPage />);
  await fireEvent.changeText(screen.getByPlaceholderText('粘贴旧书单或摘记文字'), '书名：残次品');
  await fireEvent.press(screen.getByText('生成导入预览'));
  await waitFor(() => expect(screen.getByDisplayValue('残次品')).toBeTruthy());
  await fireEvent.press(screen.getByText('确认导入'));
  await waitFor(() => expect(commitService.commit).toHaveBeenCalled());
  expect(screen.getByText('导入完成')).toBeTruthy();
  await fireEvent.press(screen.getByText('打开书库'));
  expect(router.replace).toHaveBeenCalledWith('/');
});

test('keeps pasted draft when TXT selection is cancelled', async () => {
  const screen = await render(<ImportPage />);
  expect(screen.getByText('选择来源')).toBeTruthy();
  expect(screen.getByText('导入选项')).toBeTruthy();
  await fireEvent.changeText(screen.getByPlaceholderText('粘贴旧书单或摘记文字'), '保留这段文字');
  await fireEvent.press(screen.getByText('选择 TXT 文件'));
  expect(screen.getByDisplayValue('保留这段文字')).toBeTruthy();
  expect(commitService.commit).not.toHaveBeenCalled();
});

test('defaults old records without a status to read and offers manual formats only on request', async () => {
  const screen = await render(<ImportPage />);
  expect(screen.getByRole('radio', { name: '已读' }).props.accessibilityState.checked).toBe(true);
  expect(screen.queryByText('按书填写详细资料')).toBeNull();
  await fireEvent.press(screen.getByText('识别不对？手动选择格式'));
  expect(screen.getByText('按书填写详细资料')).toBeTruthy();
  expect(screen.getByText(/书名：示例小说/)).toBeTruthy();
  expect(screen.queryByText(/微博链接/)).toBeNull();
  await fireEvent.changeText(screen.getByPlaceholderText('粘贴旧书单或摘记文字'), '书名：残次品');
  await fireEvent.press(screen.getByText('生成导入预览'));
  await waitFor(() => expect(screen.getByDisplayValue('残次品')).toBeTruthy());
  await fireEvent.press(screen.getByText('确认导入'));
  await waitFor(() => expect(commitService.commit).toHaveBeenCalledWith(expect.objectContaining({
    items: [expect.objectContaining({ candidate: expect.objectContaining({ status: 'finished' }) })],
  })));
});

test('imports multiple screenshots through manual text when local OCR is unavailable', async () => {
  jest.mocked(pickImportScreenshots).mockResolvedValue(['file:///one.png', 'file:///two.png']);
  const screen = await render(<ImportPage />);

  await fireEvent.press(screen.getByText('从截图导入'));
  await waitFor(() => expect(screen.getByText('导入截图旧记录')).toBeTruthy());
  expect(screen.getAllByText('本地识字不可用，可手动输入').length).toBe(2);
  await fireEvent.changeText(screen.getByLabelText('第 1 张文字'), '书名：残次品');
  await fireEvent.changeText(screen.getByLabelText('第 2 张文字'), '书名：默读');
  await fireEvent.press(screen.getByText('生成导入预览'));
  await waitFor(() => expect(screen.getByDisplayValue('残次品')).toBeTruthy());
  await fireEvent.press(screen.getByText('确认导入'));
  await waitFor(() => expect(commitService.commit).toHaveBeenCalled());
});

test('keeps screenshot text when the picker is cancelled and invalidates an old preview after edits', async () => {
  jest.mocked(pickImportScreenshots).mockResolvedValue(['file:///one.png']);
  const screen = await render(<ImportPage />);
  await fireEvent.press(screen.getByText('从截图导入'));
  await waitFor(() => expect(screen.getByText('导入截图旧记录')).toBeTruthy());
  await fireEvent.changeText(screen.getByLabelText('第 1 张文字'), '书名：旧书');
  jest.mocked(pickImportScreenshots).mockResolvedValue(null);
  await fireEvent.press(screen.getByText('继续选择截图'));
  expect(screen.getByDisplayValue('书名：旧书')).toBeTruthy();
  await fireEvent.press(screen.getByText('生成导入预览'));
  await waitFor(() => expect(screen.getByDisplayValue('旧书')).toBeTruthy());
  await fireEvent.press(screen.getByText('返回修改文字'));
  await fireEvent.changeText(screen.getByLabelText('第 1 张文字'), '书名：修改后');
  expect(screen.queryByText('确认导入')).toBeNull();
  expect(commitService.commit).not.toHaveBeenCalled();
});

test('shows a commit error while keeping the current review open', async () => {
  commitService.commit.mockRejectedValueOnce(new Error('事务提交失败'));
  const screen = await render(<ImportPage />);
  await fireEvent.changeText(screen.getByPlaceholderText('粘贴旧书单或摘记文字'), '书名：失败后仍保留');
  await fireEvent.press(screen.getByText('生成导入预览'));
  await waitFor(() => expect(screen.getByDisplayValue('失败后仍保留')).toBeTruthy());
  await fireEvent.press(screen.getByText('确认导入'));
  await waitFor(() => expect(screen.getByText('事务提交失败')).toBeTruthy());
  expect(screen.getByDisplayValue('失败后仍保留')).toBeTruthy();
});

test('refreshes duplicate hints when a candidate title is corrected in preview', async () => {
  books.list.mockResolvedValue([{ id: 'existing', title: '残次品', author: null }]);
  const screen = await render(<ImportPage />);
  await fireEvent.changeText(screen.getByPlaceholderText('粘贴旧书单或摘记文字'), '书名：残次品');
  await fireEvent.press(screen.getByText('生成导入预览'));
  await waitFor(() => expect(screen.getByText('书名可能已存在：残次品')).toBeTruthy());

  await fireEvent.changeText(screen.getByLabelText('第1条书名'), '默读');
  await waitFor(() => expect(screen.queryByText('书名可能已存在：残次品')).toBeNull());
});
