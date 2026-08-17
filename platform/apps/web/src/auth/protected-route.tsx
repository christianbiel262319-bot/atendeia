import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./auth-provider";

export function ProtectedRoute() {
  const { profile, booting } = useAuth();
  const location = useLocation();

  if (booting) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <span className="size-5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
          Preparando seu ambiente seguro…
        </div>
      </main>
    );
  }
  if (!profile) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}
