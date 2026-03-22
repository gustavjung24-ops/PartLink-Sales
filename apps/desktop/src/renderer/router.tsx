import { createHashRouter, Navigate } from "react-router-dom";
import { AuthGuard } from "./components/AuthGuard";
import { LicenseGuard } from "./components/LicenseGuard";
import { RoleGuard } from "./components/RoleGuard";
import { MainLayout } from "./layouts/MainLayout";
import { DashboardScreen } from "./screens/Dashboard/DashboardScreen";
import { SearchScreen } from "./screens/Search/SearchScreen";
import { PartDetailScreen } from "./screens/Parts/PartDetailScreen";
import { QuotesListScreen } from "./screens/Quotes/QuotesListScreen";
import { QuoteEditorScreen } from "./screens/Quotes/QuoteEditorScreen";
import { SearchHistoryScreen } from "./screens/History/SearchHistoryScreen";
import { TrainingScreen } from "./screens/Training/TrainingScreen";
import { AdminSettingsScreen } from "./screens/Admin/AdminSettingsScreen";
import { SyncStatusScreen } from "./screens/Sync/SyncStatusScreen";
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
        element: (
          <LicenseGuard>
            <SearchScreen />
          </LicenseGuard>
        ),
      },
      {
        path: "parts/:id",
        element: (
          <LicenseGuard>
            <PartDetailScreen />
          </LicenseGuard>
        ),
      },
      {
        path: "quotes",
        element: (
          <RoleGuard allow={["SALES", "SENIOR_SALES", "ADMIN", "SUPER_ADMIN"]}>
            <QuotesListScreen />
          </RoleGuard>
        ),
      },
      {
        path: "quotes/new",
        element: (
          <RoleGuard allow={["SALES", "SENIOR_SALES", "ADMIN", "SUPER_ADMIN"]}>
            <QuoteEditorScreen />
          </RoleGuard>
        ),
      },
      {
        path: "quotes/:id",
        element: (
          <RoleGuard allow={["SALES", "SENIOR_SALES", "ADMIN", "SUPER_ADMIN"]}>
            <QuoteEditorScreen />
          </RoleGuard>
        ),
      },
      {
        path: "history",
        element: (
          <LicenseGuard>
            <SearchHistoryScreen />
          </LicenseGuard>
        ),
      },
      {
        path: "training",
        element: (
          <LicenseGuard>
            <TrainingScreen />
          </LicenseGuard>
        ),
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
            <AdminSettingsScreen />
          </RoleGuard>
        ),
      },
      {
        path: "license-center",
        element: <Navigate to="/admin" replace />,
      },
      {
        path: "sync",
        element: (
          <LicenseGuard>
            <SyncStatusScreen />
          </LicenseGuard>
        ),
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
