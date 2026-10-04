export const THEME_STORAGE_KEY = 'novel-tracker.theme.v1';

export const THEME_IDS = ['forest', 'mist', 'clay', 'pomegranate', 'olive', 'graphite', 'ocean', 'amber'] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export type ThemePalette = {
  id: ThemeId;
  name: string;
  primary: string;
  primarySoft: string;
  primaryPressed: string;
  background: string;
  card: string;
  text: string;
  border: string;
  mutedText: string;
  rating: string;
  danger: string;
};

function pressedColor(hex: string): string {
  const rgb = hex.slice(1).match(/.{2}/g)?.map(value => Math.round(parseInt(value, 16) * 0.85)) ?? [0, 0, 0];
  return `#${rgb.map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function palette(id: ThemeId, name: string, primary: string, primarySoft: string): ThemePalette {
  return {
    id, name, primary, primarySoft, primaryPressed: pressedColor(primary),
    background: '#F6F3EC', card: '#FFFFFF', text: '#292D29', border: '#D8D5CD', mutedText: '#716F68',
    rating: '#B77B24', danger: '#9B3030',
  };
}

export const THEMES: Record<ThemeId, ThemePalette> = {
  forest: palette('forest', '墨绿', '#28584E', '#E8F1EC'),
  mist: palette('mist', '雾蓝', '#3E627D', '#E9F0F5'),
  clay: palette('clay', '陶棕', '#865942', '#F3EBE6'),
  pomegranate: palette('pomegranate', '石榴红', '#8B4352', '#F6EAED'),
  olive: palette('olive', '橄榄', '#59633B', '#F0F1E6'),
  graphite: palette('graphite', '石墨', '#445156', '#ECEFF0'),
  ocean: palette('ocean', '深海青', '#27636C', '#E6F2F2'),
  amber: palette('amber', '琥珀', '#805923', '#F6F0E4'),
};

export function getThemePalette(id: string | null | undefined): ThemePalette {
  return id && id in THEMES ? THEMES[id as ThemeId] : THEMES.forest;
}
