import type { InputHTMLAttributes, ReactNode } from "react";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  icon?: ReactNode;
};

export function AuthField({ label, hint, icon, className = "", ...props }: AuthFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold tracking-[0.08em] text-black/70">
        {label}
      </span>
      <span className="flex h-14 items-center gap-3 rounded-2xl border border-black/10 bg-white px-4 transition has-[:focus-visible]:border-blue-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-200">
        {icon ? <span className="text-black/35">{icon}</span> : null}
        <input
          {...props}
          className={`w-full bg-transparent text-sm text-black outline-none placeholder:text-black/35 focus-visible:outline-none ${className}`}
        />
      </span>
      {hint ? <span className="mt-2 block text-xs text-black/45">{hint}</span> : null}
    </label>
  );
}
