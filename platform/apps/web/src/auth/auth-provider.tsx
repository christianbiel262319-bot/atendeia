import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiRequest, decodeAccessToken, restoreApiSession, setApiSession } from "@/lib/api";

type Profile = {
  user: { id: string; email: string; fullName: string; isSuperAdmin: boolean; emailVerifiedAt: string | null };
  tenant: { id: string; name: string; slug: string; timezone: string };
  role: string;
  mfaEnabled: boolean;
};

type SignInResult =
  | { type: "done" }
  | { type: "mfa"; challengeToken: string }
  | { type: "tenant"; tenants: Array<{ id: string; name: string }> };

type AuthContextValue = {
  profile: Profile | null;
  booting: boolean;
  signIn: (input: { email: string; password: string; tenantId?: string }) => Promise<SignInResult>;
  verifyMfa: (input: { challengeToken: string; code: string }) => Promise<void>;
  registerAccount: (input: {
    companyName: string;
    fullName: string;
    email: string;
    password: string;
  }) => Promise<void>;
  registerInvitation: (input: { token: string; fullName: string; password: string }) => Promise<void>;
  reloadProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type SessionResponse = {
  data: { session: { accessToken: string; csrfToken: string; expiresIn: number } };
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [booting, setBooting] = useState(true);

  const activateSession = useCallback(async (accessToken: string) => {
    const claims = decodeAccessToken(accessToken);
    setApiSession({ accessToken, tenantId: claims.tenantId });
    const response = await apiRequest<{ data: Profile }>("/v1/auth/me", { authenticated: true });
    setProfile(response.data);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const restoredAccessToken = await restoreApiSession();
        if (active) await activateSession(restoredAccessToken);
      } catch {
        setApiSession(null);
        if (active) setProfile(null);
      } finally {
        if (active) setBooting(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [activateSession]);

  const signIn = useCallback(
    async (input: { email: string; password: string; tenantId?: string }): Promise<SignInResult> => {
      const response = await apiRequest<{
        data:
          | { requiresTenantSelection: true; tenants: Array<{ id: string; name: string }> }
          | { requiresMfa: true; challengeToken: string }
          | { requiresMfa: false; session: { accessToken: string } };
      }>("/v1/auth/login", { method: "POST", body: JSON.stringify(input) });

      const data = response.data;
      if ("requiresTenantSelection" in data && data.requiresTenantSelection) {
        return { type: "tenant", tenants: data.tenants };
      }
      if ("requiresMfa" in data && data.requiresMfa) {
        return { type: "mfa", challengeToken: data.challengeToken };
      }
      if (!("session" in data)) throw new Error("Resposta de autenticação inválida");
      await activateSession(data.session.accessToken);
      return { type: "done" };
    },
    [activateSession],
  );

  const verifyMfa = useCallback(
    async (input: { challengeToken: string; code: string }) => {
      const response = await apiRequest<SessionResponse>("/v1/auth/mfa/verify-login", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await activateSession(response.data.session.accessToken);
    },
    [activateSession],
  );

  const registerAccount = useCallback(
    async (input: { companyName: string; fullName: string; email: string; password: string }) => {
      const response = await apiRequest<SessionResponse>("/v1/auth/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await activateSession(response.data.session.accessToken);
    },
    [activateSession],
  );

  const registerInvitation = useCallback(
    async (input: { token: string; fullName: string; password: string }) => {
      const response = await apiRequest<SessionResponse>("/v1/auth/invitations/register", {
        method: "POST",
        body: JSON.stringify(input),
      });
      await activateSession(response.data.session.accessToken);
    },
    [activateSession],
  );

  const signOut = useCallback(async () => {
    try {
      await apiRequest<void>("/v1/auth/logout", {
        method: "POST",
        authenticated: true,
        csrf: true,
      });
    } finally {
      setApiSession(null);
      setProfile(null);
    }
  }, []);

  const reloadProfile = useCallback(async () => {
    const response = await apiRequest<{ data: Profile }>("/v1/auth/me", { authenticated: true });
    setProfile(response.data);
  }, []);

  const value = useMemo(
    () => ({ profile, booting, signIn, verifyMfa, registerAccount, registerInvitation, reloadProfile, signOut }),
    [profile, booting, signIn, verifyMfa, registerAccount, registerInvitation, reloadProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
