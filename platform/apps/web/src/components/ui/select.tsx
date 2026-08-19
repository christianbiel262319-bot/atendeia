import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-11 w-full rounded-brand border border-app-line bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition duration-fast focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
