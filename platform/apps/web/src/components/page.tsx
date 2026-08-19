import type { ReactNode } from "react";
import { AlertCircle, Inbox } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Page({ children, width = "max-w-[1400px]" }: { children: ReactNode; width?: string }) {
  return <main className={cn("mx-auto w-full p-4 sm:p-7 lg:p-9", width)}>{children}</main>;
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <span className="text-[10px] font-bold tracking-[0.16em] text-slate-400">{eyebrow}</span>
        <h1 className="mt-2 text-[length:var(--font-size-title)] font-semibold tracking-[-0.045em] text-slate-900">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <Card className="grid min-h-64 place-items-center p-8 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Inbox size={22} /></span>
        <h2 className="mt-4 text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </div>
    </Card>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return <p role="alert" className="flex items-start gap-2 rounded-brand border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle className="mt-0.5 shrink-0" size={16} />{message}</p>;
}

export function SuccessNotice({ message }: { message: string }) {
  return <p role="status" className="rounded-brand border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">{message}</p>;
}

export function LoadingState({ label = "Carregando dados" }: { label?: string }) {
  return (
    <div className="grid gap-3" role="status" aria-label={label}>
      {[0, 1, 2].map((item) => (
        <div className="h-24 animate-pulse rounded-[var(--radius-card)] border border-app-line bg-white" key={item} />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function StatusPill({ value }: { value: string }) {
  const positive = ["ACTIVE", "CONNECTED", "OPEN", "SENT", "DELIVERED", "READ", "PAID"].includes(value);
  const attention = ["WAITING_HUMAN", "TRIALING", "PAST_DUE", "PENDING", "DRAFT"].includes(value);
  return <span className={cn("inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide", positive ? "bg-brand-50 text-brand-700" : attention ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>{translateStatus(value)}</span>;
}

function translateStatus(value: string): string {
  const labels: Record<string, string> = {
    ACTIVE: "ATIVO", CONNECTED: "CONECTADO", OPEN: "ABERTO", WAITING_HUMAN: "AGUARDA HUMANO",
    WITH_HUMAN: "COM HUMANO", RESOLVED: "RESOLVIDO", ARCHIVED: "ARQUIVADO", DRAFT: "RASCUNHO",
    TRIALING: "EM ATIVAÇÃO", PAST_DUE: "PENDENTE", CANCELED: "CANCELADO", SUSPENDED: "SUSPENSO",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}
