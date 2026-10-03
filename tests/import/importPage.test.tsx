import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import ImportPage from '../../src/app/settings/import';
import { pickImportTxt } from '../../src/import/importPlatform';
import { useBooks, useImportCommitService, useNotes } from '../../src/storage/AppProvider';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() } }));
jest.mock('../../src/import/importPlatform', () => ({ pickImportTxt: jest.fn() }));
jest.mock('../../src/storage/AppProvider', () => ({ useBooks: jest.fn(), useNotes: jest.fn(), useImportCommitService: jest.fn() }));

const books = { list: jest.fn() };
const notes = { listNotes: jest.fn() };
const commitService = { commit: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useBooks).mockReturnValue(books as never);
  jest.mocked(useNotes).mockReturnValue(notes as never);
  jest.mocked(useImportCommitService).mockReturnValue(commitService as never);
  books.list.mockResolvedValue([]);
  notes.listNotes.mockResolvedValue([]);
  commitService.commit.mockResolvedValue({ createdBooks: 1, createdNotes: 0, appendedNotes: 0, skippedItems: 0 });
  jest.mocked(pickImportTxt).mockResolvedValue(null);
});

test('uses pasted text and TXT files as the same preview flow', async () => {
  const screen = await render(<ImportPage />);
  await fireEvent.changeText(screen.getByPlaceholderText('粘贴旧书单或摘记文字'), '书名：残次品');
  await fireEvent.press(screen.getByText('生成导入预览'));
  await waitFor(() => expect(screen.getByDisplayValue('残次品')).toBeTruthy());
  await fireEvent.press(screen.getByText('确认导入'));
  await waitFor(() => expect(commitService.commit).toHaveBeenCalled());
  expect(router.replace).toHaveBeenCalledWith('/');
});

test('keeps pasted draft when TXT selection is cancelled', async () => {
  const screen = await render(<ImportPage />);
  await fireEvent.changeText(screen.getByPlaceholderText('粘贴旧书单或摘记文字'), '保留这段文字');
  await fireEvent.press(screen.getByText('选择 TXT 文件'));
  expect(screen.getByDisplayValue('保留这段文字')).toBeTruthy();
  expect(commitService.commit).not.toHaveBeenCalled();
});
