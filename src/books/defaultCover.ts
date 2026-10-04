const PAPER_PALETTES = [
  { backgroundColor: '#DCE9E2', accentColor: '#28584E' },
  { backgroundColor: '#DEE8F0', accentColor: '#3E627D' },
  { backgroundColor: '#EEE2D8', accentColor: '#865942' },
  { backgroundColor: '#F0DEE2', accentColor: '#8B4352' },
  { backgroundColor: '#E7E9D7', accentColor: '#59633B' },
] as const;

export function getDefaultCoverStyle(bookId: string): { backgroundColor: string; accentColor: string } {
  let hash = 0;
  for (const character of bookId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return PAPER_PALETTES[hash % PAPER_PALETTES.length];
}
