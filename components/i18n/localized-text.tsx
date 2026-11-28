"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { type TranslationKey, type TranslationValues } from "@/lib/translations";

export function LocalizedText({
  k,
  values,
}: {
  k: TranslationKey;
  values?: TranslationValues;
}) {
  const { t } = useLanguage();
  let text = t[k] as string;

  if (values) {
    for (const [name, value] of Object.entries(values)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }

  return <>{text}</>;
}
