import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ImportPage from '../../src/app/settings/import';
import { pickImportTable, pickImportTxt } from '../../src/import/importPlatform';
import { parseCsvTable, parseXlsxTables } from '../../src/import/tableImportParser';
import { useBooks, useImportCommitService, useNotes, useTags } from '../../src/storage/AppProvider';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() } }));
jest.mock('../../src/import/importPlatform', () => ({ pickImportTxt: jest.fn(), pickImportTable: jest.fn() }));
jest.mock('../../src/import/tableImportParser', () => ({ parseCsvTable: jest.fn(), parseXlsxTables: jest.fn() }));
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
  jest.mocked(pickImportTxt).mockResolvedValue(null);
  books.list.mockResolvedValue([]);
  notes.listNotes.mockResolvedValue([]);
  tags.list.mockResolvedValue([]);
  commitService.commit.mockResolvedValue({ createdBooks: 1, createdNotes: 0, appendedNotes: 0, skippedItems: 0 });
});

test('CSV import enters column mapping and then the existing review flow', async () => {
  jest.mocked(pickImportTable).mockResolvedValue({ name: 'books.csv', kind: 'csv', bytes: new Uint8Array([1]) });
  jest.mocked(parseCsvTable).mockReturnValue({ name: 'CSV', rows: [
    [{ text: '书名', kind: 'text', sourceAddress: 'A1' }, { text: '作者', kind: 'text', sourceAddress: 'B1' }, { text: '备注', kind: 'text', sourceAddress: 'C1' }],
    [{ text: '旧书', kind: 'text', sourceAddress: 'A2' }, { text: '作者甲', kind: 'text', sourceAddress: 'B2' }, { text: '保留', kind: 'text', sourceAddress: 'C2' }],
  ] });
  const screen = await render(<ImportPage />);
  await fireEvent.press(screen.getByText('选择 CSV / XLSX 文件'));
  await waitFor(() => expect(screen.getByText('表格列对应')).toBeTruthy());
  expect(screen.getByDisplayValue('旧书')).toBeTruthy();
  await fireEvent.press(screen.getByText('忽略未对应列并生成预览'));
  await waitFor(() => expect(screen.getByDisplayValue('旧书')).toBeTruthy());
});

test('XLSX import asks for a worksheet before column mapping', async () => {
  jest.mocked(pickImportTable).mockResolvedValue({ name: 'books.xlsx', kind: 'xlsx', bytes: new Uint8Array([1]) });
  jest.mocked(parseXlsxTables).mockReturnValue([
    { name: '书单', rows: [[{ text: '书名', kind: 'text', sourceAddress: 'A1' }], [{ text: '第一本', kind: 'text', sourceAddress: 'A2' }]] },
    { name: '摘记', rows: [[{ text: '正文', kind: 'text', sourceAddress: 'A1' }]] },
  ]);
  const screen = await render(<ImportPage />);
  await fireEvent.press(screen.getByText('选择 CSV / XLSX 文件'));
  await waitFor(() => expect(screen.getByText('选择工作表')).toBeTruthy());
  await fireEvent.press(screen.getByText('书单'));
  expect(screen.getByText('表格列对应')).toBeTruthy();
});
