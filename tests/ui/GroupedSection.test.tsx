import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { GroupedSection } from '../../src/ui/GroupedSection';

test('renders section title and content', async () => {
  const view = await render(<GroupedSection title="基本信息"><Text>作者</Text></GroupedSection>);
  expect(view.getByText('基本信息')).toBeTruthy();
  expect(view.getByText('作者')).toBeTruthy();
});
