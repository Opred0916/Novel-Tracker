import type { BookStatus } from '../books/types';

export type TableCell = {
  text: string;
  kind: 'text' | 'number' | 'date' | 'formula';
  sourceAddress: string;
};

export type TableSheet = { name: string; rows: TableCell[][] };
export type TableField = 'title' | 'author' | 'protagonists' | 'status' | 'rating' | 'bookType' | 'tags' | 'startedOn' | 'endedOn' | 'note' | 'noteRecordedOn' | 'whyWantToRead' | 'platform';
export type TableColumnMapping = Partial<Record<TableField, number>>;
export type TableRowIssue = { rowNumber: number; field: TableField | null; rawValue: string; message: string };
export type TableMappingOptions = {
  hasHeader: boolean;
  defaultStatus: BookStatus;
  ignoredColumns: number[];
  skippedRows: number[];
  protagonistDelimiter: string;
  tagDelimiter: string;
  tagIdsByName: ReadonlyMap<string, string>;
};
