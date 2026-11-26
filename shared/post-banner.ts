export const POST_BANNER_URL_MAX_LENGTH = 500;

export function postBannerUrl(
  value: string | null | undefined,
): string | undefined {
  const input = value?.trim();
  if (!input || input.length > POST_BANNER_URL_MAX_LENGTH) return undefined;
  if (!/^https:\/\//i.test(input)) return undefined;
  try {
    const parsed = new URL(input);
    if (parsed.username || parsed.password) return undefined;
    const url = parsed.href;
    return url.length >= 12 && url.length <= POST_BANNER_URL_MAX_LENGTH
      ? url
      : undefined;
  } catch {
    return undefined;
  }
}
