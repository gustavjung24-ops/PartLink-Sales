import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { useAuthStore } from "../../stores/authStore";

const EMAIL_HINT = "user@sparelink.local";

/** Guard demo credentials so hardcoded values never ship in production builds. */
const isDev = import.meta.env.DEV;

export function LoginScreen(): JSX.Element {
  const navigate = useNavigate();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const login = useAuthStore((state) => state.login);
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
  const redirectAfterLogin = useAuthStore((state) => state.redirectAfterLogin);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);
  const warning = useAuthStore((state) => state.lastSessionWarning);
  const clearError = useAuthStore((state) => state.clearError);

  const [email, setEmail] = useState(isDev ? EMAIL_HINT : "");
  const [password, setPassword] = useState(isDev ? "Password@123" : "");
  const [rememberMe, setRememberMe] = useState(false);
  const [isForgotFlow, setIsForgotFlow] = useState(false);
  const [forgotEmail, setForgotEmail] = useState(isDev ? EMAIL_HINT : "");
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [setupChecking, setSetupChecking] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [adminName, setAdminName] = useState("System Admin");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");

  // Redirect already-authenticated users away from /login
  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectAfterLogin || "/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate, redirectAfterLogin]);

  useEffect(() => {
    let cancelled = false;
    const checkSetup = async () => {
      try {
        const status = await window.electronAPI.auth.getSetupStatus();
        if (!cancelled) {
          setSetupRequired(!status.hasUsers);
        }
      } catch {
        if (!cancelled) {
          // Nếu không đọc được setup status, vẫn cho phép thử login như cũ.
          setSetupRequired(false);
        }
      } finally {
        if (!cancelled) {
          setSetupChecking(false);
        }
      }
    };

    void checkSetup();
    return () => {
      cancelled = true;
    };
  }, []);

  const submitLabel = useMemo(() => (isLoading ? "Đang xử lý..." : "Đăng nhập"), [isLoading]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearError();

    try {
      await login({
        email,
        password,
        rememberMe,
      });

      navigate(redirectAfterLogin || "/dashboard", { replace: true });
    } catch {
      // Error state is handled by auth store.
    }
  };

  const handleForgotPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setForgotMessage(null);

    try {
      const result = await requestPasswordReset(forgotEmail);
      setForgotMessage(result.message);
    } catch (forgotError) {
      const message = forgotError instanceof Error ? forgotError.message : "Không thể gửi yêu cầu đặt lại mật khẩu.";
      setForgotMessage(message);
    }
  };

  const handleCreateInitialAdmin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSetupError(null);

    if (adminPassword !== adminPasswordConfirm) {
      setSetupError("Mật khẩu xác nhận không khớp");
      return;
    }

    try {
      await window.electronAPI.auth.createInitialAdmin({
        name: adminName.trim(),
        email: adminEmail.trim(),
        password: adminPassword,
      });

      await login({
        email: adminEmail.trim(),
        password: adminPassword,
        rememberMe: true,
      });

      navigate("/dashboard", { replace: true });
    } catch (setupErr) {
      const message = setupErr instanceof Error ? setupErr.message : "Không thể tạo ADMIN đầu tiên";
      setSetupError(message);
    }
  };

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center px-4 py-10">
      <div className="grid w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-300/30 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/30 md:grid-cols-[1.2fr_1fr]">
        <div className="hidden bg-[radial-gradient(circle_at_top_left,_#0ea5e9,_#0284c7_35%,_#0f172a)] p-8 text-white md:flex md:flex-col md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-100/80">SPARELINK SALES</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight">
              Đăng nhập để tiếp tục điều phối báo giá, phê duyệt và đồng bộ.
            </h1>
          </div>
          <p className="text-sm text-sky-100/90">
            Mẹo: dùng tài khoản demo ADMIN để kiểm tra phân quyền thanh điều hướng.
          </p>
        </div>

        <div className="space-y-6 p-6 md:p-8">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Xin chào trở lại</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Đăng nhập bằng email công ty để tiếp tục phiên làm việc.
            </p>
          </div>

          {warning ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
              {warning}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200">
              {error}
            </div>
          ) : null}

          {setupChecking ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
              Đang kiểm tra cấu hình ban đầu...
            </div>
          ) : null}

          {setupRequired ? (
            <form className="space-y-4" onSubmit={handleCreateInitialAdmin}>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-200">
                Hệ thống chưa có tài khoản. Hãy tạo ADMIN đầu tiên để bắt đầu sử dụng.
              </div>

              {setupError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200">
                  {setupError}
                </div>
              ) : null}

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">Họ tên quản trị</span>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                  type="text"
                  value={adminName}
                  onChange={(event) => setAdminName(event.target.value)}
                  required
                />
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">Email quản trị</span>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                  type="email"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  required
                />
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">Mật khẩu</span>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  required
                />
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-200">Xác nhận mật khẩu</span>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                  type="password"
                  value={adminPasswordConfirm}
                  onChange={(event) => setAdminPasswordConfirm(event.target.value)}
                  required
                />
              </label>

              <Button className="w-full" disabled={isLoading} type="submit">
                Tạo ADMIN và đăng nhập
              </Button>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleLogin}>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">Email</span>
              <input
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => { setEmail(event.target.value); clearError(); }}
                required
              />
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-200">Mật khẩu</span>
              <input
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => { setPassword(event.target.value); clearError(); }}
                required
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              Ghi nhớ tôi trên thiết bị này
            </label>

            <Button className="w-full" disabled={isLoading} type="submit">
              {submitLabel}
            </Button>
            </form>
          )}

          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button
              type="button"
              className="text-sm font-medium text-sky-700 transition hover:text-sky-600 dark:text-sky-300 dark:hover:text-sky-200"
              onClick={() => setIsForgotFlow((value) => !value)}
            >
              {isForgotFlow ? "Ẩn đặt lại mật khẩu" : "Quên mật khẩu?"}
            </button>

            {isForgotFlow ? (
              <form className="space-y-3" onSubmit={handleForgotPassword}>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900"
                  type="email"
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  placeholder="email@company.com"
                  required
                />
                <Button type="submit" variant="outline">
                  Gửi yêu cầu đặt lại
                </Button>
                {forgotMessage ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">{forgotMessage}</p>
                ) : null}
              </form>
            ) : null}
          </div>

          {isDev ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Demo: user@sparelink.local | senior@sparelink.local | admin@sparelink.local | super@sparelink.local
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
