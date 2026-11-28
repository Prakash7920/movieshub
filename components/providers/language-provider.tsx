"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { type Language, getTranslations, languageLabels } from "@/lib/translations";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  refreshLanguagePreference: () => Promise<void>;
  t: ReturnType<typeof getTranslations>;
};

type ProfilePreferenceResponse = {
  profile?: {
    languagePreference?: unknown;
  };
};

const defaultLanguage: Language = "en";
const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);
  const selectionRevision = useRef(0);

  const setLanguage = useCallback((nextLanguage: Language) => {
    selectionRevision.current += 1;
    setLanguageState(nextLanguage);
    window.localStorage.setItem("nexafilm-language", nextLanguage);
    document.documentElement.lang = nextLanguage;
  }, []);

  const refreshLanguagePreference = useCallback(async () => {
    const revisionAtRequest = selectionRevision.current;

    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      if (!response.ok) return;

      const payload = (await response.json().catch(() => null)) as ProfilePreferenceResponse | null;
      const preferred = payload?.profile?.languagePreference;
      if (preferred !== "en" && preferred !== "ta") return;

      // Keep a language choice made while this request was in flight.
      if (selectionRevision.current !== revisionAtRequest) return;

      setLanguageState(preferred);
      window.localStorage.setItem("nexafilm-language", preferred);
      document.documentElement.lang = preferred;
    } catch {
      // Account preference sync must never prevent navigation or basic browsing.
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("nexafilm-language") as Language | null;
    if (stored === "en" || stored === "ta") {
      setLanguageState(stored);
    } else {
      const browserLanguage = navigator.language.toLowerCase();
      setLanguageState(browserLanguage.startsWith("ta") ? "ta" : defaultLanguage);
    }

    // For signed-in users, their saved account preference takes precedence
    // over this browser's guest preference.
    void refreshLanguagePreference();
  }, [refreshLanguagePreference]);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("nexafilm-language", language);
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      refreshLanguagePreference,
      t: getTranslations(language),
    }),
    [language, setLanguage, refreshLanguagePreference],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }

  return context;
}

export { languageLabels };
