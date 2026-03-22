import { createHashRouter, Navigate } from "react-router-dom";
import { LicenseGuard } from "./components/LicenseGuard";
import { AppShell } from "./layouts/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { LicenseActivationPage } from "./pages/License/LicenseActivationPage";
import { SettingsPage } from "./pages/SettingsPage";

export const router = createHashRouter([
  {
    path: "/license",
    element: <LicenseActivationPage />,
  },
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />
      },
      {
        path: "dashboard",
        element: (
          <LicenseGuard>
            <DashboardPage />
          </LicenseGuard>
        )
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
