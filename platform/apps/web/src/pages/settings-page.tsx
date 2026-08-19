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
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Seções das configurações">
        {sections.map(({ key, label, icon: Icon }) => (
          <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => selectSection(key)} className={cn("inline-flex min-h-11 shrink-0 items-center gap-2 rounded-brand border px-4 text-sm font-semibold transition duration-fast", section === key ? "border-brand-700 bg-brand-700 text-white" : "border-app-line bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50")}><Icon size={16} />{label}</button>
        ))}
      </div>
      {section === "empresa" ? <CompanySettings /> : null}
      {section === "perfil" ? <ProfileSettings /> : null}
      {section === "seguranca" ? <SecuritySettings /> : null}
    </Page>
  );
}
