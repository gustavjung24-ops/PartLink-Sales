import { create } from "zustand";
import type { AuthLoginPayload, AuthSession, AuthUser, PasswordResetResult, UserRole } from "@/shared/electronApi";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  roles: UserRole[];
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  isLoading: boolean;
  error: string | null;
  redirectAfterLogin: string;
  rememberMe: boolean;
  lastSessionWarning: string | null;

  bootstrap: () => Promise<void>;
  login: (payload: AuthLoginPayload) => Promise<void>;
  logout: (reason?: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<PasswordResetResult>;
  setRedirectAfterLogin: (path: string) => void;
  clearError: () => void;
  getAccessToken: () => string | null;
}

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let timeoutTimer: ReturnType<typeof setTimeout> | null = null;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function clearSessionTimers(): void {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
  }
}

function applySession(session: AuthSession, rememberMe: boolean): Partial<AuthState> {
  return {
    user: session.user,
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    roles: session.user.roles,
    isAuthenticated: true,
    rememberMe,
    error: null,
    lastSessionWarning: null,
  };
}

function scheduleSessionLifecycle(get: () => AuthState): void {
  clearSessionTimers();

  const state = get();
  if (!state.isAuthenticated || !state.refreshToken || !state.expiresAt) {
    return;
  }

  const now = Date.now();
  const refreshIn = Math.max(0, state.expiresAt - now - 60_000);
  const timeoutIn = Math.max(0, state.expiresAt - now);

  refreshTimer = setTimeout(async () => {
    const current = get();
    if (!current.refreshToken || !current.isAuthenticated) {
      return;
    }

    try {
      const refreshed = await window.electronAPI.auth.refresh({
        refreshToken: current.refreshToken,
      });

      const updatedSession: AuthSession = {
        accessToken: refreshed.accessToken,
        refreshToken: current.refreshToken,
        user: current.user!,
        issuedAt: Date.now(),
        expiresAt: refreshed.expiresAt,
      };

      useAuthStore.setState({
        accessToken: refreshed.accessToken,
        expiresAt: refreshed.expiresAt,
        error: null,
      });

      if (current.rememberMe) {
        await window.electronAPI.auth.saveSession(updatedSession);
      }

      scheduleSessionLifecycle(get);
    } catch {
      await useAuthStore.getState().logout("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
    }
  }, refreshIn);

  timeoutTimer = setTimeout(async () => {
    await useAuthStore.getState().logout("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.");
  }, timeoutIn);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  roles: [],
  isAuthenticated: false,
  isBootstrapping: true,
  isLoading: false,
  error: null,
  redirectAfterLogin: "/dashboard",
  rememberMe: false,
  lastSessionWarning: null,

  bootstrap: async () => {
    set({ isBootstrapping: true, error: null });

    try {
      if (!window.electronAPI?.auth) {
        throw new Error("Electron bridge unavailable");
      }

      const session = await withTimeout(
        window.electronAPI.auth.loadSession(),
        8000,
        "Khởi tạo phiên bị timeout"
      );

      if (!session) {
        set({ isBootstrapping: false });
        return;
      }

      if (Date.now() >= session.expiresAt) {
        const refreshed = await withTimeout(
          window.electronAPI.auth.refresh({ refreshToken: session.refreshToken }),
          8000,
          "Làm mới phiên bị timeout"
        );
        const refreshedSession: AuthSession = {
          ...session,
          accessToken: refreshed.accessToken,
          expiresAt: refreshed.expiresAt,
          issuedAt: Date.now(),
        };

        await withTimeout(
          window.electronAPI.auth.saveSession(refreshedSession),
          8000,
          "Lưu phiên bị timeout"
        );
        set({ ...applySession(refreshedSession, true), isBootstrapping: false });
        scheduleSessionLifecycle(get);
        return;
      }

      set({ ...applySession(session, true), isBootstrapping: false });
      scheduleSessionLifecycle(get);
    } catch {
      try {
        await withTimeout(window.electronAPI.auth.clearSession(), 4000, "Clear session timeout");
      } catch {
        // Ignore clear-session failures during bootstrap fallback.
      }
      clearSessionTimers();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        roles: [],
        isAuthenticated: false,
        isBootstrapping: false,
        rememberMe: false,
      });
    }
  },

  login: async (payload) => {
    set({ isLoading: true, error: null, lastSessionWarning: null });

    try {
      const result = await window.electronAPI.auth.login(payload);
      const session: AuthSession = {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: result.user,
        issuedAt: result.issuedAt,
        expiresAt: result.expiresAt,
      };

      if (payload.rememberMe) {
        await window.electronAPI.auth.saveSession(session);
      } else {
        await window.electronAPI.auth.clearSession();
      }

      set({ ...applySession(session, Boolean(payload.rememberMe)), isLoading: false });
      scheduleSessionLifecycle(get);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể đăng nhập";
      clearSessionTimers();
      set({ isLoading: false, error: message, isAuthenticated: false });
      throw error;
    }
  },

  logout: async (reason) => {
    const refreshToken = get().refreshToken;

    clearSessionTimers();
    try {
      await window.electronAPI.auth.logout({ refreshToken: refreshToken ?? undefined });
    } catch {
      // Ignore network or revoke failures and still clear local session.
    }

    await window.electronAPI.auth.clearSession();

    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      roles: [],
      isAuthenticated: false,
      isLoading: false,
      rememberMe: false,
      error: null,
      lastSessionWarning: reason ?? null,
      redirectAfterLogin: "/dashboard",
    });
  },

  requestPasswordReset: async (email) => {
    return window.electronAPI.auth.requestPasswordReset({ email });
  },

  setRedirectAfterLogin: (path) => {
    set({ redirectAfterLogin: path });
  },

  clearError: () => {
    set({ error: null, lastSessionWarning: null });
  },

  getAccessToken: () => get().accessToken,
}));
