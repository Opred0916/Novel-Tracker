import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RatingField } from '../../src/books/RatingField';

test('selects and clears a half-star rating', async () => {
  function Harness() {
    const [value, setValue] = useState<number | null>(null);
    return <RatingField value={value} onChange={setValue} allowNewValue />;
  }
  const screen = await render(<Harness />);
  await fireEvent.press(screen.getByLabelText('4.5 星'));
  expect(screen.getByText('4.5 / 5 星')).toBeTruthy();
  await fireEvent.press(screen.getByText('清除评分'));
  expect(screen.getByText('未评分')).toBeTruthy();
});

test('shows an existing rating without allowing a different value outside finished status', async () => {
  function Harness() {
    const [value, setValue] = useState<number | null>(9);
    return <RatingField value={value} onChange={setValue} allowNewValue={false} />;
  }
  const screen = await render(<Harness />);
  expect(screen.getByText('4.5 / 5 星')).toBeTruthy();
  expect(screen.queryByLabelText('5 星')).toBeNull();
  await fireEvent.press(screen.getByText('清除评分'));
  expect(screen.getByText('未评分')).toBeTruthy();
});
