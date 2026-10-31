"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { type Language, getTranslations, languageLabels } from "@/lib/translations";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: ReturnType<typeof getTranslations>;
};

const defaultLanguage: Language = "en";

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);

  useEffect(() => {
    const stored = window.localStorage.getItem("movieshub-language") as Language | null;
    if (stored === "en" || stored === "ta") {
      setLanguageState(stored);
      return;
    }

    const browserLanguage = navigator.language.toLowerCase();
    const preferred = browserLanguage.startsWith("ta") ? "ta" : "en";
    setLanguageState(preferred);
  }, []);

  const setLanguage = (nextLanguage: Language) => {
    setLanguageState(nextLanguage);
    window.localStorage.setItem("movieshub-language", nextLanguage);
    document.documentElement.lang = nextLanguage;
  };

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("movieshub-language", language);
  }, [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: getTranslations(language),
    }),
    [language],
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
