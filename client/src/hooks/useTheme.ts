"use client";

import { useEffect, useMemo, useState } from "react";

export type ThemeMode = "dark" | "light";

const STORAGE_KEY = "taskpilot.theme";

const getPreferredTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: light)")?.matches
    ? "light"
    : "dark";
};

const applyThemeToDom = (theme: ThemeMode) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
};

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>("dark");

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    const initial = (stored === "dark" || stored === "light") ? stored : getPreferredTheme();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(initial);
    applyThemeToDom(initial);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: ThemeMode = prev === "dark" ? "light" : "dark";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
      applyThemeToDom(next);
      return next;
    });
  };

  const isDark = useMemo(() => theme === "dark", [theme]);

  return { theme, isDark, toggleTheme };
}

