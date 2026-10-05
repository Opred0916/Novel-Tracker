import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { ChoiceChip } from '../../src/ui/ChoiceChip';

jest.mock('../../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: {
    primary: '#28584E', primarySoft: '#E8F1EC', primaryPressed: '#224B42',
    background: '#F6F3EC', card: '#FFFFFF', text: '#292D29', border: '#D8D5CD',
    mutedText: '#716F68', rating: '#B77B24', danger: '#9B3030',
  } }),
}));

test('renders selected chip with theme fill and checked radio state', async () => {
  const view = await render(<ChoiceChip label="读完" selected selectionRole="radio" onPress={jest.fn()} />);
  const chip = view.getByRole('radio', { name: '读完' });
  expect(chip.props.accessibilityState).toEqual(expect.objectContaining({ checked: true }));
  expect(chip.props.style).toEqual(expect.arrayContaining([
    expect.objectContaining({ backgroundColor: '#28584E', borderColor: '#28584E' }),
  ]));
  expect(view.getByText('读完').props.style).toEqual(expect.arrayContaining([
    expect.objectContaining({ color: '#FFFFFF' }),
  ]));
});

test('uses checkbox semantics and does not fire while disabled', async () => {
  const onPress = jest.fn();
  const view = await render(<ChoiceChip label="古代" selected={false} selectionRole="checkbox" disabled onPress={onPress} />);
  const chip = view.getByRole('checkbox', { name: '古代' });
  expect(chip.props.accessibilityState).toEqual(expect.objectContaining({ checked: false, disabled: true }));
  fireEvent.press(chip);
  expect(onPress).not.toHaveBeenCalled();
});
