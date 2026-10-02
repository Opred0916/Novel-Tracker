import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { ReadingDateFields } from '../../src/books/ReadingDateFields';

test('keeps the date when the iPhone wheel is cancelled and commits only on completion', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  const onStartChange = jest.fn();
  const onEndChange = jest.fn();
  const screen = await render(<ReadingDateFields startedOn="2026-09-01" endedOn="2026-09-10" showEnd
    onStartChange={onStartChange} onEndChange={onEndChange} />);

  await fireEvent.press(screen.getByLabelText('开始日期'));
  await fireEvent(screen.getByTestId('reading-date-picker'), 'valueChange', {}, new Date(2026, 7, 31, 12));
  await fireEvent.press(screen.getByText('取消'));
  expect(onStartChange).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByLabelText('开始日期'));
  await fireEvent(screen.getByTestId('reading-date-picker'), 'valueChange', {}, new Date(2026, 7, 31, 12));
  await fireEvent.press(screen.getByText('完成'));
  expect(onStartChange).toHaveBeenCalledWith('2026-08-31');
  expect(onEndChange).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByLabelText('开始日期'));
  const ancientDate = new Date(0);
  ancientDate.setFullYear(99, 0, 1);
  ancientDate.setHours(12, 0, 0, 0);
  await fireEvent(screen.getByTestId('reading-date-picker'), 'valueChange', {}, ancientDate);
  await fireEvent.press(screen.getByText('完成'));
  expect(onStartChange).toHaveBeenLastCalledWith('0099-01-01');
  await screen.rerender(<ReadingDateFields startedOn="0099-01-01" endedOn="2026-09-10" showEnd
    onStartChange={onStartChange} onEndChange={onEndChange} />);
  await fireEvent.press(screen.getByLabelText('开始日期'));
  expect(screen.getByTestId('reading-date-picker').props.value.getFullYear()).toBe(99);
});

test('uses the Android date dialog and saves only a selected date', async () => {
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  const onEndChange = jest.fn();
  const screen = await render(<ReadingDateFields startedOn="2026-09-01" endedOn="2026-09-10" showEnd
    onStartChange={jest.fn()} onEndChange={onEndChange} />);
  await fireEvent.press(screen.getByLabelText('结束日期'));
  const options = jest.mocked(DateTimePickerAndroid.open).mock.calls.at(-1)?.[0];
  expect(options?.mode).toBe('date');
  expect(onEndChange).not.toHaveBeenCalled();
  options?.onValueChange?.({ nativeEvent: { timestamp: 0, utcOffset: 0 } }, new Date(2026, 8, 15, 12));
  expect(onEndChange).toHaveBeenCalledWith('2026-09-15');
});
