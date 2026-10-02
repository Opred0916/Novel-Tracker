import { fireEvent, render } from '@testing-library/react-native';
import { Platform } from 'react-native';

export async function chooseReadingDate(screen: Awaited<ReturnType<typeof render>>,
  field: '开始日期' | '结束日期', year: number, month: number, day: number) {
  Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
  await fireEvent.press(screen.getByLabelText(field));
  await fireEvent(screen.getByTestId('reading-date-picker'), 'valueChange', {}, new Date(year, month - 1, day, 12));
  await fireEvent.press(screen.getByText('完成'));
}
