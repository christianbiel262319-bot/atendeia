import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, MailPlus, Shield, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/auth/auth-provider";
import { EmptyState, ErrorNotice, Page, PageHeader, StatusPill } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiRequest } from "@/lib/api";

const inviteSchema = z.object({ email: z.email("Informe um e-mail válido"), role: z.enum(["ADMIN", "MANAGER", "AGENT", "VIEWER"]) });
type InviteValues = z.infer<typeof inviteSchema>;
type Member = { id: string; role: string; active: boolean; mfaEnabled: boolean; createdAt: string; user: { id: string; fullName: string; email: string; status: string } };
type Invitation = { id: string; email: string; role: string; expiresAt: string; token: string };

export function TeamPage() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const members = useQuery({
    queryKey: ["team"],
    queryFn: async () => (await apiRequest<{ data: Member[] }>("/v1/team", { authenticated: true })).data,
  });
  const form = useForm<InviteValues>({ resolver: zodResolver(inviteSchema), defaultValues: { email: "", role: "AGENT" } });
  const invite = useMutation({
    mutationFn: async (values: InviteValues) => (await apiRequest<{ data: Invitation }>("/v1/team/invitations", { method: "POST", authenticated: true, body: JSON.stringify(values) })).data,
    onSuccess: (data) => { setInvitation(data); form.reset({ email: "", role: "AGENT" }); },
  });
  const update = useMutation({
    mutationFn: async (input: { id: string; role?: string; active?: boolean }) => apiRequest(`/v1/team/members/${input.id}`, { method: "PATCH", authenticated: true, body: JSON.stringify({ ...(input.role ? { role: input.role } : {}), ...(input.active !== undefined ? { active: input.active } : {}) }) }),
    onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["team"] }), queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] })]); },
  });
  const canManage = profile?.role === "OWNER" || profile?.role === "ADMIN";
  const invitationUrl = invitation ? `${window.location.origin}/convite?token=${encodeURIComponent(invitation.token)}` : null;

  return <Page><PageHeader eyebrow="EQUIPE" title="Pessoas e permissões" description="Controle quem pode configurar a IA, administrar a empresa ou atender clientes." />
    <div className="grid gap-5 xl:grid-cols-[1fr_390px]">
      <section>
        {members.isError ? <ErrorNotice message={members.error.message} /> : null}
        {!members.isLoading && members.data?.length === 0 ? <EmptyState title="Nenhum membro" description="Convide a primeira pessoa para começar a operação humana." /> : <div className="grid gap-3">{members.data?.map((member) => <Card key={member.id} className="flex flex-wrap items-center gap-4 p-4 sm:p-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-slate-100 text-slate-500"><UserRound size={20} /></span><div className="min-w-48 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{member.user.fullName}</strong><StatusPill value={member.active ? "ACTIVE" : "INACTIVE"} />{member.mfaEnabled ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-violet-700"><Shield size={12} /> MFA</span> : null}</div><p className="mt-1 text-xs text-slate-500">{member.user.email}</p></div><Select className="w-40" value={member.role} disabled={!canManage || update.isPending} onChange={(event) => update.mutate({ id: member.id, role: event.target.value })}><option value="OWNER">Proprietário</option><option value="ADMIN">Administrador</option><option value="MANAGER">Gestor</option><option value="AGENT">Atendente</option><option value="VIEWER">Leitura</option></Select>{canManage && member.user.id !== profile?.user.id ? <Button variant="outline" size="sm" disabled={update.isPending} onClick={() => update.mutate({ id: member.id, active: !member.active })}>{member.active ? "Desativar" : "Reativar"}</Button> : null}</Card>)}</div>}
      </section>
      <Card className="h-fit p-5 sm:p-6"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><MailPlus size={19} /></span><div><h2 className="font-semibold">Convidar pessoa</h2><p className="mt-1 text-xs text-slate-500">O link expira em sete dias.</p></div></div>{canManage ? <form className="mt-5 grid gap-4" onSubmit={(event) => void form.handleSubmit((values) => invite.mutateAsync(values))(event)}><Field label="E-mail" error={form.formState.errors.email?.message}><Input type="email" {...form.register("email")} /></Field><Field label="Perfil"><Select {...form.register("role")}><option value="ADMIN">Administrador</option><option value="MANAGER">Gestor</option><option value="AGENT">Atendente</option><option value="VIEWER">Somente leitura</option></Select></Field>{invite.error ? <ErrorNotice message={invite.error.message} /> : null}<Button type="submit" disabled={invite.isPending}><Users size={16} />{invite.isPending ? "Criando…" : "Criar convite"}</Button></form> : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Somente proprietários e administradores podem criar convites.</p>}
        {invitationUrl ? <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4"><strong className="text-xs text-amber-900">Copie agora: o token não será exibido novamente.</strong><p className="mt-2 break-all text-[11px] leading-5 text-amber-800">{invitationUrl}</p><Button className="mt-3" variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(invitationUrl)}><Copy size={14} /> Copiar link</Button></div> : null}
      </Card>
    </div>
  </Page>;
}
