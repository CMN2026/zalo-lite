import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppLanguage = "vi" | "en";
export type AppTheme = "light" | "dark";

const LANGUAGE_KEY = "zalo-lite:mobile:language";
const THEME_KEY = "zalo-lite:mobile:theme";

type SettingsContextType = {
  language: AppLanguage;
  theme: AppTheme;
  setLanguage: (language: AppLanguage) => void;
  setTheme: (theme: AppTheme) => void;
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>("vi");
  const [theme, setThemeState] = useState<AppTheme>("light");

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((value) => {
        if (value === "vi" || value === "en") {
          setLanguageState(value);
        }
      })
      .catch(() => undefined);

    AsyncStorage.getItem(THEME_KEY)
      .then((value) => {
        if (value === "light" || value === "dark") {
          setThemeState(value);
        }
      })
      .catch(() => undefined);
  }, []);

  const setLanguage = (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);
    void AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage);
  };

  const setTheme = (nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    void AsyncStorage.setItem(THEME_KEY, nextTheme);
  };

  const value = useMemo(
    () => ({ language, theme, setLanguage, setTheme }),
    [language, theme],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}
