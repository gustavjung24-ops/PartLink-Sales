import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { UserRole } from "@/shared/electronApi";
import { useAuthStore } from "../stores/authStore";

interface RoleGuardProps {
  children: ReactNode;
  allow: UserRole[];
}

export function RoleGuard({ children, allow }: RoleGuardProps): JSX.Element {
  const roles = useAuthStore((state) => state.roles);
  const isAllowed = roles.some((role) => allow.includes(role));

  if (!isAllowed) {
    // Set a warning the layout can display before navigating away
    useAuthStore.setState({ lastSessionWarning: "Bạn không có quyền truy cập trang này." });
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
