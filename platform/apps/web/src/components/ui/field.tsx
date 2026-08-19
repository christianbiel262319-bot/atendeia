import type { ReactNode } from "react";

export function Field({ label, hint, error, children }: { label: string; hint?: string | undefined; error?: string | undefined; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      {children}
      {hint && !error ? <span className="text-xs font-normal leading-5 text-slate-500">{hint}</span> : null}
      {error ? <span className="text-xs font-normal text-red-600">{error}</span> : null}
    </label>
  );
}
