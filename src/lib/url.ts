export function httpsImageUrl(
  value: string | null | undefined,
): string | undefined {
  const url = value?.trim() ?? "";
  if (!url.startsWith("https://")) return undefined;
  return url;
}
