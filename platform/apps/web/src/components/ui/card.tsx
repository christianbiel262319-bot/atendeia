import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-[var(--radius-card)] border border-app-line bg-app-surface shadow-[0_1px_2px_rgb(20_45_34_/_4%)]", className)} {...props} />;
}
