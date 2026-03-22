import { useMemo, useState, useEffect, useRef } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { useLicense } from "../hooks/useLicense";
import { useOfflineStore } from "../stores/offlineStore";
import { getLicenseBadgeClass, calcDaysRemaining } from "../lib/licenseUtils";

interface NavItem {
  label: string;
  path: string;
  roles: Array<"*" | "USER" | "SALES" | "SENIOR_SALES" | "ADMIN" | "SUPER_ADMIN">;
}

const navItems: NavItem[] = [
  { label: "Dashboard", path: "/dashboard", roles: ["*"] },
  { label: "Tra mã & Quy đổi", path: "/lookup", roles: ["*"] },
  { label: "Báo giá", path: "/quotes", roles: ["SALES", "SENIOR_SALES", "ADMIN", "SUPER_ADMIN"] },
  { label: "Lịch sử", path: "/history", roles: ["*"] },
  { label: "Đào tạo", path: "/training", roles: ["*"] },
  { label: "Phê duyệt", path: "/approvals", roles: ["SENIOR_SALES", "ADMIN", "SUPER_ADMIN"] },
  { label: "Quản trị Kiến thức", path: "/knowledge-admin", roles: ["ADMIN", "SUPER_ADMIN"] },
  { label: "Ngành hàng", path: "/categories", roles: ["ADMIN", "SUPER_ADMIN"] },
  { label: "Quản trị", path: "/admin", roles: ["ADMIN", "SUPER_ADMIN"] },
  { label: "Bản quyền", path: "/license-center", roles: ["SUPER_ADMIN"] },
  { label: "Đồng bộ", path: "/sync", roles: ["*"] },
];

function canAccess(roles: string[], itemRoles: NavItem["roles"]): boolean {
  if (itemRoles.includes("*")) {
    return true;
  }

  return roles.some((role) => itemRoles.includes(role as NavItem["roles"][number]));
}

function formatBreadcrumb(pathname: string): Array<{ label: string; path: string }> {
  const segments = pathname.split("/").filter(Boolean);
  return segments.map((segment, index) => ({
    label: decodeURIComponent(segment)
      .replace(/-/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase()),
    path: "/" + segments.slice(0, index + 1).join("/"),
  }));
}

export function MainLayout(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();

  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const roles = useAuthStore((state) => state.roles);

  const { state: licenseState, license } = useLicense();
  const { isOnline, lastSyncTime, getPendingSyncItems } = useOfflineStore();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => canAccess(roles, item.roles)),
    [roles]
  );

  const breadcrumbItems = useMemo(() => formatBreadcrumb(location.pathname), [location.pathname]);

  const daysRemaining = useMemo(() => calcDaysRemaining(license?.expiresAt ?? null), [license?.expiresAt]);

  const pendingSyncCount = getPendingSyncItems().length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const withCommand = event.metaKey || event.ctrlKey;

      if (withCommand && key === "k") {
        event.preventDefault();
        navigate("/lookup");
      }

      if (!withCommand && key === "n") {
        event.preventDefault();
        navigate("/quotes/new");
      }

      if (!withCommand && key === "h") {
        event.preventDefault();
        navigate("/history");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close sidebar when route changes (mobile nav)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen bg-[radial-gradient(circle_at_top_left,_#ecfeff,_#f8fafc_45%,_#e2e8f0)] text-slate-900 dark:bg-[radial-gradient(circle_at_top_left,_#1e293b,_#020617_48%,_#020617)] dark:text-slate-100">
      {/* Mobile overlay backdrop */}
      {isSidebarOpen ? (
        <div
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={[
          "w-72 border-r border-slate-200/80 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70",
          "flex-col",
          // Mobile: fixed overlay, toggled by hamburger
          isSidebarOpen ? "fixed inset-y-0 left-0 z-30 flex" : "hidden",
          // Desktop: always visible static
          "md:static md:z-auto md:flex",
        ].join(" ")}
      >
        <Link className="mb-5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold shadow-sm dark:border-slate-800 dark:bg-slate-900" to="/dashboard">
          SPARELINK SALES
        </Link>

        <nav className="space-y-1">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                [
                  "block rounded-lg px-3 py-2 text-sm transition",
                  isActive
                    ? "bg-sky-600 text-white shadow"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span>Giấy phép</span>
            <span className={["rounded-full border px-2 py-0.5 font-medium", getLicenseBadgeClass(licenseState, daysRemaining)].join(" ")}>
              {licenseState}
            </span>
          </div>
          {licenseState === "TRIAL" ? <p>Còn {daysRemaining} ngày dùng thử</p> : null}
          <div className="flex items-center justify-between">
            <span>Đồng bộ</span>
            <span className={isOnline ? "text-emerald-600" : "text-amber-600"}>{isOnline ? "Online" : "Offline"}</span>
          </div>
          <p>Hàng đợi: {pendingSyncCount}</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {/* Hamburger — only visible on mobile */}
              <button
                type="button"
                aria-label="Mở menu điều hướng"
                className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
                onClick={() => setIsSidebarOpen((v) => !v)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <div className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">⌘/Ctrl+K Tra mã | N Báo giá mới | H Lịch sử</div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  <Link className="hover:text-slate-900 dark:hover:text-slate-100" to="/dashboard">
                    Home
                  </Link>
                  {breadcrumbItems.map((item, index) => {
                    const isLast = index === breadcrumbItems.length - 1;
                    return (
                      <span key={item.path}>
                        {" / "}
                        {isLast ? (
                          <span>{item.label}</span>
                        ) : (
                          <Link className="hover:text-slate-900 dark:hover:text-slate-100" to={item.path}>
                            {item.label}
                          </Link>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div ref={profileRef} className="relative">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={() => setIsProfileOpen((value) => !value)}
              >
                {user?.name ?? "Tài khoản"}
              </button>

              {isProfileOpen ? (
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900">
                  <p className="text-sm font-semibold">{user?.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Vai trò: {roles.join(", ")}</p>
                  <button
                    type="button"
                    className="mt-3 w-full rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
                    onClick={async () => {
                      setIsProfileOpen(false);
                      await logout();
                      navigate("/login", { replace: true });
                    }}
                  >
                    Đăng xuất
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className={["rounded-full border px-2 py-1", getLicenseBadgeClass(licenseState, daysRemaining)].join(" ")}>
              {licenseState === "TRIAL" ? `TRIAL (${daysRemaining} ngày)` : licenseState}
            </span>
            <span className="rounded-full border border-slate-300 px-2 py-1 dark:border-slate-700">
              Sync: {isOnline ? "Online" : "Offline"}
            </span>
            <span className="rounded-full border border-slate-300 px-2 py-1 dark:border-slate-700">
              Pending: {pendingSyncCount}
            </span>
            {lastSyncTime ? (
              <span className="rounded-full border border-slate-300 px-2 py-1 dark:border-slate-700">
                Last sync: {new Date(lastSyncTime).toLocaleString()}
              </span>
            ) : null}
          </div>
        </header>

        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
