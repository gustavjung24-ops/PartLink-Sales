import { createHashRouter, Navigate } from "react-router-dom";
import { AuthGuard } from "./components/AuthGuard";
import { LicenseGuard } from "./components/LicenseGuard";
import { RoleGuard } from "./components/RoleGuard";
import { MainLayout } from "./layouts/MainLayout";
import { DashboardScreen } from "./screens/Dashboard/DashboardScreen";
import { LicenseActivationPage } from "./pages/License/LicenseActivationPage";
import { LoginScreen } from "./screens/Login/LoginScreen";
import { SettingsPage } from "./pages/SettingsPage";

function PlaceholderPage({ title }: { title: string }): JSX.Element {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Chức năng sẽ được hoàn thiện trong các sprint kế tiếp.</p>
    </section>
  );
}

export const router = createHashRouter([
  {
    path: "/login",
    element: <LoginScreen />,
  },
  {
    path: "/license",
    element: <LicenseActivationPage />,
  },
  {
    path: "/",
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />
      },
      {
        path: "dashboard",
        element: (
          <LicenseGuard>
            <DashboardScreen />
          </LicenseGuard>
        )
      },
      {
        path: "lookup",
        element: <PlaceholderPage title="Tra mã & Quy đổi" />,
      },
      {
        path: "quotes",
        element: (
          <RoleGuard allow={["SALES", "SENIOR_SALES", "ADMIN", "SUPER_ADMIN"]}>
            <PlaceholderPage title="Báo giá" />
          </RoleGuard>
        ),
      },
      {
        path: "quotes/new",
        element: <PlaceholderPage title="Tạo báo giá mới" />,
      },
      {
        path: "history",
        element: <PlaceholderPage title="Lịch sử" />,
      },
      {
        path: "training",
        element: <PlaceholderPage title="Đào tạo" />,
      },
      {
        path: "approvals",
        element: (
          <RoleGuard allow={["SENIOR_SALES", "ADMIN", "SUPER_ADMIN"]}>
            <PlaceholderPage title="Phê duyệt" />
          </RoleGuard>
        ),
      },
      {
        path: "knowledge-admin",
        element: (
          <RoleGuard allow={["ADMIN", "SUPER_ADMIN"]}>
            <PlaceholderPage title="Quản trị Kiến thức" />
          </RoleGuard>
        ),
      },
      {
        path: "categories",
        element: (
          <RoleGuard allow={["ADMIN", "SUPER_ADMIN"]}>
            <PlaceholderPage title="Ngành hàng" />
          </RoleGuard>
        ),
      },
      {
        path: "admin",
        element: (
          <RoleGuard allow={["ADMIN", "SUPER_ADMIN"]}>
            <PlaceholderPage title="Quản trị" />
          </RoleGuard>
        ),
      },
      {
        path: "license-center",
        element: (
          <RoleGuard allow={["SUPER_ADMIN"]}>
            <PlaceholderPage title="Bản quyền" />
          </RoleGuard>
        ),
      },
      {
        path: "sync",
        element: <PlaceholderPage title="Đồng bộ" />,
      },
      {
        path: "settings",
        element: (
          <LicenseGuard>
            <SettingsPage />
          </LicenseGuard>
        )
      }
    ]
  }
]);
