jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: object) => React.createElement(View, { testID: 'reading-date-picker', ...props }),
    DateTimePickerAndroid: { open: jest.fn() },
  };
});
