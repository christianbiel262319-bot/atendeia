import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Page, PageHeader } from "@/components/page";
import { cn } from "@/lib/utils";
import { CompanySettings } from "@/pages/settings/company-settings";
import { ProfileSettings } from "@/pages/settings/profile-settings";
import { SecuritySettings } from "@/pages/settings/security-settings";

const sections = [
  { key: "empresa", label: "Empresa", icon: Building2 },
  { key: "perfil", label: "Perfil", icon: UserRound },
  { key: "seguranca", label: "Segurança", icon: ShieldCheck },
] as const;
type Section = (typeof sections)[number]["key"];

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get("secao");
  const section: Section = sections.some((item) => item.key === requested) ? requested as Section : "empresa";

  function selectSection(next: Section): void {
    setParams({ secao: next }, { replace: true });
  }

  return (
    <Page width="max-w-5xl">
      <PageHeader eyebrow="CONFIGURAÇÕES" title="Empresa e segurança" description="Dados da organização, perfil pessoal, senha, MFA e sessões ativas ficam separados por contexto." />
      <div className="mb-6 grid grid-cols-3 gap-1.5 sm:flex sm:gap-2" role="tablist" aria-label="Seções das configurações">
        {sections.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => selectSection(key)} className={cn("inline-flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-brand border px-1 py-2 text-[11px] font-semibold transition duration-fast sm:min-h-11 sm:flex-row sm:gap-2 sm:px-4 sm:py-0 sm:text-sm", section === key ? "border-brand-700 bg-brand-700 text-white" : "border-app-line bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50")}><Icon size={16} /><span className="truncate">{label}</span></button>
        ))}
      </div>
      {section === "empresa" ? <CompanySettings /> : null}
      {section === "perfil" ? <ProfileSettings /> : null}
      {section === "seguranca" ? <SecuritySettings /> : null}
    </Page>
  );
}
