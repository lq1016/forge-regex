import {
  translate,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";

/** Map API error strings/codes to localized copy. */
export function localizeApiError(
  locale: Locale,
  error: unknown,
  fallbackKey: MessageKey = "networkError"
): string {
  const raw =
    typeof error === "string"
      ? error
      : typeof error === "object" &&
          error &&
          "error" in error &&
          typeof (error as { error?: unknown }).error === "string"
        ? (error as { error: string }).error
        : "";

  const code =
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";

  const keyByCode: Record<string, MessageKey> = {
    sign_in_required: "errSignInRequired",
    pro_required: "errProRequired",
    share_needs_pro: "errShareNeedsPro",
    pattern_required: "errPatternRequired",
  };

  if (code && keyByCode[code]) {
    return translate(locale, keyByCode[code]);
  }

  const keyByMessage: Record<string, MessageKey> = {
    "Sign in required.": "errSignInRequired",
    "Pro required.": "errProRequired",
    "Sharing requires Pro. Upgrade to create a public link.": "errShareNeedsPro",
    "Pattern is required.": "errPatternRequired",
  };

  if (raw && keyByMessage[raw]) {
    return translate(locale, keyByMessage[raw]);
  }

  if (raw) return raw;
  return translate(locale, fallbackKey);
}
