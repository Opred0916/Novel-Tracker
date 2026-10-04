import { getThemePalette, THEME_IDS, THEMES, type ThemeId } from '../../src/theme/theme';

describe('theme palettes', () => {
  test('defines the eight named presets and the forest default', () => {
    expect(THEME_IDS).toHaveLength(8);
    expect(getThemePalette(undefined).id).toBe('forest');
    expect(getThemePalette('unknown' as ThemeId).id).toBe('forest');
    expect(THEMES.forest.primary).toBe('#28584E');
    expect(THEMES.forest.primarySoft).toBe('#E8F1EC');
    expect(THEMES.amber.primary).toBe('#805923');
  });

  test('provides a pressed color and stable semantic colors for every preset', () => {
    for (const id of THEME_IDS) {
      const palette = THEMES[id];
      expect(palette.primaryPressed).toMatch(/^#[0-9A-F]{6}$/);
      expect(palette.background).toBe('#F6F3EC');
      expect(palette.card).toBe('#FFFFFF');
      expect(palette.rating).toBe('#B77B24');
      expect(palette.danger).toBe('#9B3030');
    }
  });
});
