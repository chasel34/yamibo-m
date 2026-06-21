import React from 'react';
import { render } from '@testing-library/react-native';
import { GroupPill } from '../src/components/ui';
import { ThemeContext, light } from '../src/theme';

test('renders a small React Native component with the theme provider', () => {
  const tree = render(
    <ThemeContext.Provider value={{ t: light, theme: 'light', setTheme: jest.fn(), uiFontLevel: 1, setUiFontLevel: jest.fn() }}>
      <GroupPill>会员</GroupPill>
    </ThemeContext.Provider>,
  );
  expect(tree).toBeDefined();
});
