import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ActionRow } from '../../src/ui/ActionRow';

test('exposes a single tappable row with a useful name', async () => {
  const onPress = jest.fn();
  const view = await render(<ActionRow label="备份与恢复" detail="保管你的书库" value="未备份" onPress={onPress} />);
  const row = view.getByRole('button', { name: '备份与恢复' });
  expect(view.getByText('保管你的书库')).toBeTruthy();
  expect(view.getByText('未备份')).toBeTruthy();
  fireEvent.press(row);
  expect(onPress).toHaveBeenCalledTimes(1);
});
