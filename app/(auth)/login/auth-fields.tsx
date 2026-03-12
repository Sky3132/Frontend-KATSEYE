"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  icon?: ReactNode;
};

export function AuthField({ label, hint, icon, className = "", ...props }: AuthFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isPasswordField = props.type === "password";
  const inputType = isPasswordField && isPasswordVisible ? "text" : props.type;

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold tracking-[0.08em] text-black/70 dark:text-[#f1d04b]">
        {label}
      </span>
      <span className="flex h-14 items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 transition has-[:focus-visible]:border-blue-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-200 dark:border-[#2f2a16] dark:bg-[#11110f] dark:has-[:focus-visible]:border-[#f1d04b] dark:has-[:focus-visible]:ring-[#f1d04b]/25">
        {icon ? <span className="text-black/35 dark:text-[#f1d04b]/70">{icon}</span> : null}
        <input
          {...props}
          type={inputType}
          className={`w-full bg-transparent text-sm text-black outline-none placeholder:text-black/35 focus-visible:outline-none dark:text-[#f1d04b] dark:placeholder:text-[#c7ba81] ${className}`}
        />
        {isPasswordField ? (
          <button
            type="button"
            aria-label={isPasswordVisible ? "Hide password" : "Show password"}
            aria-pressed={isPasswordVisible}
            onClick={() => setIsPasswordVisible((current) => !current)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-black/45 transition hover:bg-black/5 hover:text-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:text-[#c7ba81] dark:hover:bg-[#f1d04b]/10 dark:hover:text-[#f1d04b] dark:focus-visible:ring-[#f1d04b]/25"
          >
            {isPasswordVisible ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px]"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 3L21 21"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="M10.58 10.58C10.21 10.95 10 11.46 10 12C10 13.1 10.9 14 12 14C12.54 14 13.05 13.79 13.42 13.42"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M9.88 5.09C10.56 4.87 11.27 4.75 12 4.75C16.5 4.75 20.14 9.21 21 12C20.67 13.06 19.85 14.52 18.61 15.79"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14.12 18.91C13.44 19.13 12.73 19.25 12 19.25C7.5 19.25 3.86 14.79 3 12C3.33 10.94 4.15 9.48 5.39 8.21"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-[18px] w-[18px]"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2.25 12C3.23 8.9 7.14 4.75 12 4.75C16.86 4.75 20.77 8.9 21.75 12C20.77 15.1 16.86 19.25 12 19.25C7.14 19.25 3.23 15.1 2.25 12Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3.25"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            )}
          </button>
        ) : null}
      </span>
      {hint ? <span className="mt-2 block text-xs text-black/45 dark:text-[#c7ba81]">{hint}</span> : null}
    </label>
  );
}
