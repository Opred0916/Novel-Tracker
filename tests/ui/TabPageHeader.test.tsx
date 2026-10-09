import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { TabPageHeader } from '../../src/ui/TabPageHeader';

test('keeps the tab title below the status bar', async () => {
  const view = await render(<SafeAreaInsetsContext.Provider value={{ top: 47, bottom: 34, left: 0, right: 0 }}>
    <TabPageHeader title="书架" subtitle="记录喜欢的故事" />
  </SafeAreaInsetsContext.Provider>);
  expect(view.getByText('书架')).toBeTruthy();
  expect(view.getByText('记录喜欢的故事')).toBeTruthy();
  expect(view.getByTestId('tab-page-header').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ paddingTop: 59 })]));
});
