export function safeUrl(value: string): boolean {
  const normalized = value.replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
  if (normalized.startsWith("//")) return false;
  return (
    !/^[a-z][a-z0-9+.-]*:/i.test(normalized) ||
    /^(https?:|mailto:|tel:)/i.test(normalized)
  );
}
