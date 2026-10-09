import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SuggestionField } from '../../src/books/SuggestionField';

jest.mock('../../src/theme/ThemeProvider', () => ({
  useTheme: () => ({ theme: { primary: '#28584E', primarySoft: '#E8F1EC', primaryPressed: '#224B42', card: '#FFFFFF', text: '#292D29', border: '#D8D5CD', mutedText: '#716F68' } }),
}));

test('deduplicates suggestions and fills the free-form field when tapped', async () => {
  const onChange = jest.fn();
  const view = await render(<SuggestionField label="作者" placeholder="作者名字" value="" onChange={onChange} suggestions={[' Priest ', 'Priest', '', '某作者']} />);
  expect(view.getAllByText('Priest')).toHaveLength(1);
  fireEvent.press(view.getByText('某作者'));
  expect(onChange).toHaveBeenCalledWith('某作者');
});

test('deletes a history suggestion without clearing the current input', async () => {
  const onChange = jest.fn();
  const onRemove = jest.fn();
  const view = await render(<SuggestionField label="作者" placeholder="作者名字" value="当前作者" onChange={onChange} suggestions={['旧作者']} onRemoveSuggestion={onRemove} />);
  fireEvent.press(view.getByRole('button', { name: '删除作者记录：旧作者' }));
  expect(onRemove).toHaveBeenCalledWith('旧作者');
  expect(onChange).not.toHaveBeenCalled();
});
