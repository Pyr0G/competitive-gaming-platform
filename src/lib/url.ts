export function httpsImageUrl(
  value: string | null | undefined,
): string | undefined {
  try {
    const parsed = new URL((value ?? "").trim());
    if (parsed.protocol === "https:") return parsed.href;
  } catch {
    return undefined;
  }
  return undefined;
}
