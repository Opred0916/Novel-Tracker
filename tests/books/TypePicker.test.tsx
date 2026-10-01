import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { TypePicker } from '../../src/books/TypePicker';

test('selects one work type and can clear it', async () => {
  const onChange = jest.fn();
  const screen = await render(<TypePicker value={null} onChange={onChange} />);
  await fireEvent.press(screen.getByText('耽美'));
  expect(onChange).toHaveBeenCalledWith('romance_male_male');
  await fireEvent.press(screen.getByText('其他'));
  expect(onChange).toHaveBeenCalledWith('other');
  await fireEvent.press(screen.getByText('不分类'));
  expect(onChange).toHaveBeenCalledWith(null);
});
