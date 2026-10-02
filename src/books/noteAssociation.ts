import type { ReadingSession } from './types';

export function findReadingSessionForNote(noteDate: string, sessions: ReadingSession[]): string | null {
  const matches = sessions.filter(session => {
    if (session.startedOn > noteDate) return false;
    if (session.outcome === 'reading') return true;
    return session.endedOn !== null && noteDate <= session.endedOn;
  });
  matches.sort((left, right) => right.ordinal - left.ordinal);
  return matches[0]?.id ?? null;
}
