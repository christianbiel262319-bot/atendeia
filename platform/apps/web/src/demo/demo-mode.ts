export const DEMO_BACKEND_MESSAGE = "Disponível após conectar o ambiente de homologação";

const demoSessionKey = "atendeia.preview.demo-session";

type DemoAvailabilityInput = {
  development: boolean;
  previewFlag?: string | undefined;
  stage?: string | undefined;
};

export type DemoSessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function canEnableDemoMode({ development, previewFlag, stage }: DemoAvailabilityInput): boolean {
  if (development) return true;
  return stage === "preview" && previewFlag === "true";
}

export const demoModeAvailable = canEnableDemoMode({
  development: import.meta.env.DEV,
  previewFlag: import.meta.env.VITE_ATENDEIA_PREVIEW,
  stage: import.meta.env.VITE_ATENDEIA_STAGE,
});

export const demoProfile = {
  user: {
    id: "00000000-0000-4000-8000-00000000d001",
    email: "demo@preview.atendeia.local",
    fullName: "Administrador DEMO",
    isSuperAdmin: true,
    emailVerifiedAt: "2026-08-19T12:00:00.000Z",
  },
  tenant: {
    id: "00000000-0000-4000-8000-00000000d002",
    name: "Empresa Demonstração — DEMO",
    slug: "empresa-demonstracao-demo",
    timezone: "America/Sao_Paulo",
  },
  role: "OWNER",
  mfaEnabled: false,
} as const;

export function hasAuthorizedDemoSession(available: boolean, storage: DemoSessionStore): boolean {
  return available && storage.getItem(demoSessionKey) === "active";
}

export function createAuthorizedDemoSession(available: boolean, storage: DemoSessionStore): void {
  if (!available) throw new Error("O modo demonstração não está disponível nesta build");
  storage.setItem(demoSessionKey, "active");
}

export function isDemoSessionActive(): boolean {
  if (!demoModeAvailable || typeof window === "undefined") return false;
  return hasAuthorizedDemoSession(demoModeAvailable, window.sessionStorage);
}

export function startDemoSession(): void {
  if (!demoModeAvailable || typeof window === "undefined") {
    throw new Error("O modo demonstração não está disponível nesta build");
  }
  createAuthorizedDemoSession(demoModeAvailable, window.sessionStorage);
}

export function endDemoSession(): void {
  if (typeof window !== "undefined") window.sessionStorage.removeItem(demoSessionKey);
}
