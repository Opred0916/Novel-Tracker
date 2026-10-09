import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { BottomSheet } from '../../src/ui/BottomSheet';

test('renders a titled sheet and closes from button, backdrop, and request close', async () => {
  const onClose = jest.fn();
  const view = await render(<BottomSheet visible title="筛选" onClose={onClose}><Text>内容</Text></BottomSheet>);
  expect(view.getByText('筛选')).toBeTruthy();
  expect(view.getByText('内容')).toBeTruthy();
  expect(view.getByTestId('bottom-sheet-scroll').props.automaticallyAdjustKeyboardInsets).toBe(true);
  await fireEvent.press(view.getByLabelText('关闭筛选'));
  await fireEvent.press(view.getByLabelText('关闭筛选面板'));
  const modal = view.getByTestId('bottom-sheet-modal');
  modal.props.onRequestClose();
  expect(onClose).toHaveBeenCalledTimes(3);
});

test('does not render closed sheet content', async () => {
  const view = await render(<BottomSheet visible={false} title="筛选" onClose={jest.fn()}><Text>内容</Text></BottomSheet>);
  expect(view.queryByText('内容')).toBeNull();
});
