import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AddBookForm } from '../../src/books/AddBookForm';

test('adds a novel with only its title', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined);
  const screen = await render(<AddBookForm onSave={onSave} />);
  await fireEvent.changeText(screen.getByPlaceholderText('输入小说书名'), '  长夜  ');
  await fireEvent.press(screen.getByText('保存到想读'));
  await waitFor(() => expect(onSave).toHaveBeenCalledWith({ title: '长夜', status: 'want_to_read' }));
});
