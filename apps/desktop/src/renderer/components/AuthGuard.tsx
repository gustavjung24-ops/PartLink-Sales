import { Navigate, useLocation } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "../stores/authStore";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps): JSX.Element {
  const location = useLocation();
  const isBootstrapping = useAuthStore((state) => state.isBootstrapping);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setRedirectAfterLogin = useAuthStore((state) => state.setRedirectAfterLogin);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    const destination = `${location.pathname}${location.search}${location.hash}`;
    setRedirectAfterLogin(destination === "/" ? "/dashboard" : destination);
  }, [isAuthenticated, location.hash, location.pathname, location.search, setRedirectAfterLogin]);

  if (isBootstrapping) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white/80 p-6 text-sm text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
        Đang khởi tạo phiên người dùng...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
