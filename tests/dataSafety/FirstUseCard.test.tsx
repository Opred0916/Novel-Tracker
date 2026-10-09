import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { FirstUseCard } from '../../src/dataSafety/FirstUseCard';

test('first-use card explains local storage and offers two nonblocking actions', async () => {
  const onDismiss = jest.fn();
  const onLearnMore = jest.fn();
  const screen = await render(<FirstUseCard onDismiss={onDismiss} onLearnMore={onLearnMore} />);
  expect(screen.getByText(/记录保存在这台设备/)).toBeTruthy();
  expect(screen.getByText(/完整备份/)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: '明白了' }));
  expect(onDismiss).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: '了解备份' }));
  expect(onLearnMore).toHaveBeenCalledTimes(1);
});
