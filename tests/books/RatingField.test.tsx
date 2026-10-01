import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { RatingField } from '../../src/books/RatingField';

test('selects and clears a half-star rating', async () => {
  function Harness() {
    const [value, setValue] = useState<number | null>(null);
    return <RatingField value={value} onChange={setValue} allowNewValue />;
  }
  const screen = await render(<Harness />);
  await fireEvent(screen.getByTestId('rating-slider'), 'valueChange', 4.5);
  expect(screen.getByText('4.5 / 5 星')).toBeTruthy();
  expect(screen.getByLabelText('第 1 颗星：实心')).toBeTruthy();
  expect(screen.getByLabelText('第 5 颗星：半星')).toBeTruthy();
  await fireEvent.press(screen.getByText('清除评分'));
  expect(screen.getByText('未评分')).toBeTruthy();
  expect(screen.getByLabelText('第 1 颗星：空心')).toBeTruthy();
});

test('shows an existing rating without allowing a different value outside finished status', async () => {
  function Harness() {
    const [value, setValue] = useState<number | null>(9);
    return <RatingField value={value} onChange={setValue} allowNewValue={false} />;
  }
  const screen = await render(<Harness />);
  expect(screen.getByText('4.5 / 5 星')).toBeTruthy();
  expect(screen.queryByTestId('rating-slider')).toBeNull();
  await fireEvent.press(screen.getByText('清除评分'));
  expect(screen.getByText('未评分')).toBeTruthy();
});

test('slider can return to zero for an unrated book', async () => {
  function Harness() {
    const [value, setValue] = useState<number | null>(null);
    return <RatingField value={value} onChange={setValue} allowNewValue />;
  }
  const screen = await render(<Harness />);
  await fireEvent(screen.getByTestId('rating-slider'), 'valueChange', 0.5);
  expect(screen.getByText('0.5 / 5 星')).toBeTruthy();
  expect(screen.getByLabelText('第 1 颗星：半星')).toBeTruthy();
  await fireEvent(screen.getByTestId('rating-slider'), 'valueChange', 0);
  expect(screen.getByText('未评分')).toBeTruthy();
});
