import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-28 w-full resize-y rounded-brand border border-app-line bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition duration-fast placeholder:text-slate-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
