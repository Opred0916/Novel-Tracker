export type CloudConfig = { url: string; publishableKey: string };

export function readCloudConfig(input: { url?: string; publishableKey?: string }): CloudConfig | null {
  const url = input.url?.trim().replace(/\/+$/, '') ?? '';
  const publishableKey = input.publishableKey?.trim() ?? '';
  if (!url || !publishableKey) return null;
  if (publishableKey.startsWith('sb_secret_') || /service.role/i.test(publishableKey)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return { url, publishableKey };
  } catch {
    return null;
  }
}
