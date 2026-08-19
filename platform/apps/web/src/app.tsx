import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/auth-provider";
import { ProtectedRoute } from "@/auth/protected-route";
import { AppLayout } from "@/layouts/app-layout";

const AcceptInvitePage = lazy(async () => ({ default: (await import("@/pages/accept-invite-page")).AcceptInvitePage }));
const AutomationPage = lazy(async () => ({ default: (await import("@/pages/automation-page")).AutomationPage }));
const ContactsPage = lazy(async () => ({ default: (await import("@/pages/contacts-page")).ContactsPage }));
const ConversationsPage = lazy(async () => ({ default: (await import("@/pages/conversations-page")).ConversationsPage }));
const DashboardPage = lazy(async () => ({ default: (await import("@/pages/dashboard-page")).DashboardPage }));
const ForgotPasswordPage = lazy(async () => ({ default: (await import("@/pages/forgot-password-page")).ForgotPasswordPage }));
const KnowledgePage = lazy(async () => ({ default: (await import("@/pages/knowledge-page")).KnowledgePage }));
const LoginPage = lazy(async () => ({ default: (await import("@/pages/login-page")).LoginPage }));
const PlansPage = lazy(async () => ({ default: (await import("@/pages/plans-page")).PlansPage }));
const RegisterPage = lazy(async () => ({ default: (await import("@/pages/register-page")).RegisterPage }));
const ResetPasswordPage = lazy(async () => ({ default: (await import("@/pages/reset-password-page")).ResetPasswordPage }));
const SettingsPage = lazy(async () => ({ default: (await import("@/pages/settings-page")).SettingsPage }));
const SuperAdminPage = lazy(async () => ({ default: (await import("@/pages/super-admin-page")).SuperAdminPage }));
const TeamPage = lazy(async () => ({ default: (await import("@/pages/team-page")).TeamPage }));
const VerifyEmailPage = lazy(async () => ({ default: (await import("@/pages/verify-email-page")).VerifyEmailPage }));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

export function AtendeIaApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<AppLoadingState />}><Routes>
            <Route path="/entrar" element={<LoginPage />} />
            <Route path="/criar-conta" element={<RegisterPage />} />
            <Route path="/esqueci-senha" element={<ForgotPasswordPage />} />
            <Route path="/redefinir-senha" element={<ResetPasswordPage />} />
            <Route path="/verificar-email" element={<VerifyEmailPage />} />
            <Route path="/convite" element={<AcceptInvitePage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="atendimentos" element={<ConversationsPage />} />
                <Route path="contatos" element={<ContactsPage />} />
                <Route path="conhecimento" element={<KnowledgePage />} />
                <Route path="automacao" element={<AutomationPage />} />
                <Route path="equipe" element={<TeamPage />} />
                <Route path="planos" element={<PlansPage />} />
                <Route path="configuracoes" element={<SettingsPage />} />
                <Route path="super-admin" element={<SuperAdminPage />} />
              </Route>
            </Route>
          </Routes></Suspense>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function AppLoadingState() {
  return <main className="grid min-h-screen place-items-center bg-app-canvas" role="status"><div className="flex items-center gap-3 text-sm font-medium text-slate-600"><span className="size-5 animate-spin rounded-full border-2 border-brand-700 border-t-transparent" />Carregando AtendeIA…</div></main>;
}
