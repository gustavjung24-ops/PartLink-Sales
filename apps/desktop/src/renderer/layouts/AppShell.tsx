import { useEffect } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { LicenseInfoWidget } from "../components/LicenseGuard";
import { useThemeStore } from "../stores/uiStore";

function ThemeToggle(): JSX.Element {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  return (
    <button
      className="rounded-md border border-slate-300 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      type="button"
    >
      {theme === "light" ? "Dark" : "Light"} mode
    </button>
  );
}

export function AppShell(): JSX.Element {
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const checkLicense = async () => {
      try {
        const isValid = await window.electronAPI.license.isValid();

        if (isMounted && !isValid) {
          navigate("/license", { replace: true });
        }
      } catch {
        if (isMounted) {
          navigate("/license", { replace: true });
        }
      }
    };

    void checkLicense();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#fff8e7,_#f3f4f6_45%,_#e2e8f0)] text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_#1e293b,_#0f172a_45%,_#020617)] dark:text-slate-100">
      <header className="border-b border-slate-200/70 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link className="text-lg font-semibold tracking-tight" to="/dashboard">
            SPARELINK
          </Link>
          <nav className="flex items-center gap-3 text-sm">
            <NavLink
              className={({ isActive }) =>
                isActive ? "font-semibold text-sky-600 dark:text-sky-300" : "text-slate-600 dark:text-slate-300"
              }
              to="/dashboard"
            >
              Dashboard
            </NavLink>
            <NavLink
              className={({ isActive }) =>
                isActive ? "font-semibold text-sky-600 dark:text-sky-300" : "text-slate-600 dark:text-slate-300"
              }
              to="/settings"
            >
              Settings
            </NavLink>
            <LicenseInfoWidget />
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-4">
        <Outlet />
      </main>
    </div>
  );
}
