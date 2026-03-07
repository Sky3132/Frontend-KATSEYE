"use client";

import { useEffect, useSyncExternalStore } from "react";

const THEME_STORAGE_KEY = "katseye-theme";
const THEME_EVENT = "katseye:theme";

type Theme = "light" | "dark";

const getPreferredTheme = (): Theme => {
  if (typeof window === "undefined") return "light";

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.dataset.theme = theme;
};

const subscribeTheme = (callback: () => void) => {
  if (typeof window === "undefined") return () => {};

  const handleThemeChange = () => callback();
  window.addEventListener(THEME_EVENT, handleThemeChange);
  window.addEventListener("storage", handleThemeChange);

  return () => {
    window.removeEventListener(THEME_EVENT, handleThemeChange);
    window.removeEventListener("storage", handleThemeChange);
  };
};

type ThemeToggleProps = {
  className?: string;
};

export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const theme = useSyncExternalStore(subscribeTheme, getPreferredTheme, () => "light");

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={`inline-flex h-10 items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 text-sm font-medium text-[#111] transition hover:border-black/25 dark:border-[#f1d04b]/35 dark:bg-[#12120f] dark:text-[#f1d04b] ${className}`}
    >
      <span
        className={`relative flex h-5 w-5 items-center justify-center rounded-full transition ${
          isDark ? "bg-[#f1d04b] text-[#0b0b0a]" : "bg-[#111] text-white"
        }`}
      >
        {isDark ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 3V5.5M12 18.5V21M4.929 4.929L6.697 6.697M17.303 17.303L19.071 19.071M3 12H5.5M18.5 12H21M4.929 19.071L6.697 17.303M17.303 6.697L19.071 4.929M16 12C16 14.209 14.209 16 12 16C9.791 16 8 14.209 8 12C8 9.791 9.791 8 12 8C14.209 8 16 9.791 16 12Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M20 15.2C19.151 15.717 18.153 16 17.089 16C13.996 16 11.489 13.493 11.489 10.4C11.489 9.336 11.772 8.338 12.289 7.489C9.207 7.874 6.818 10.502 6.818 13.691C6.818 17.143 9.657 19.982 13.109 19.982C16.298 19.982 18.926 17.593 19.311 14.511C19.516 14.732 19.747 14.962 20 15.2Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
