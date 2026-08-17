import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/auth-provider";
import { ProtectedRoute } from "@/auth/protected-route";
import { AppLayout } from "@/layouts/app-layout";
import { AcceptInvitePage } from "@/pages/accept-invite-page";
import { AutomationPage } from "@/pages/automation-page";
import { ContactsPage } from "@/pages/contacts-page";
import { ConversationsPage } from "@/pages/conversations-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { KnowledgePage } from "@/pages/knowledge-page";
import { LoginPage } from "@/pages/login-page";
import { PlansPage } from "@/pages/plans-page";
import { RegisterPage } from "@/pages/register-page";
import { SettingsPage } from "@/pages/settings-page";
import { SuperAdminPage } from "@/pages/super-admin-page";
import { TeamPage } from "@/pages/team-page";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/entrar" element={<LoginPage />} />
            <Route path="/criar-conta" element={<RegisterPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/convite" element={<AcceptInvitePage />} />
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
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
