export function shouldShowIntro(input: {
  introSeen: boolean | null;
  totalBooks: number | null;
  status: string | null;
  hasConditions: boolean;
  loading: boolean;
  resultsCurrent: boolean;
  bulkMode: boolean;
}): boolean {
  return input.introSeen === false && input.totalBooks === 0 && input.status === null
    && !input.hasConditions && !input.loading && input.resultsCurrent && !input.bulkMode;
}

export function shouldShowBackupReminder(input: {
  handled: boolean | null;
  bookCount: number | null;
  lastGeneratedAt: string | null;
}): boolean {
  return input.handled === false && input.bookCount !== null && input.bookCount > 0
    && input.lastGeneratedAt === null;
}
