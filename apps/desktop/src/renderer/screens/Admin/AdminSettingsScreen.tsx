import { useEffect, useState } from "react";
import { useAuthStore } from "../../stores/authStore";
import { useOfflineStore } from "../../stores/offlineStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AppUser {
  id: string;
  name: string;
  email: string;
  role: string;
  lastLogin: string | null;
  active: boolean;
}

const AI_CONFIG_KEY = "sparelink:admin:aiConfig";
const AUDIT_KEY = "sparelink:admin:auditLog";

interface AiConfig {
  enabled: boolean;
  confidenceThreshold: number;
  requireApprovalThreshold: number;
  maxResultsPerSearch: number;
}

interface SystemConfig {
  apiBaseUrl: string;
  syncIntervalSeconds: number;
  offlineCacheDays: number;
}

interface LicenseConfig {
  licenseKeyMasked: string;
  maxActivations: number;
  supportContact: string;
}

const DEFAULT_AI: AiConfig = {
  enabled: true,
  confidenceThreshold: 50,
  requireApprovalThreshold: 75,
  maxResultsPerSearch: 5,
};

const SYSTEM_CONFIG_KEY = "sparelink:admin:systemConfig";
const LICENSE_CONFIG_KEY = "sparelink:admin:licenseConfig";

const DEFAULT_SYSTEM_CONFIG: SystemConfig = {
  apiBaseUrl: "https://api.sparelink.local",
  syncIntervalSeconds: 30,
  offlineCacheDays: 14,
};

const DEFAULT_LICENSE_CONFIG: LicenseConfig = {
  licenseKeyMasked: "SL-2026-XXXX-XXXX",
  maxActivations: 3,
  supportContact: "license@sparelink.local",
};

interface AuditEntry {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
}

const DEFAULT_AUDIT: AuditEntry[] = [
  { id: "a1", user: "minhc@company.com", action: "UPDATE_ROLE", target: "thib@company.com → SENIOR_SALES", timestamp: "2025-07-14T11:30:00Z" },
  { id: "a2", user: "minhc@company.com", action: "APPROVE_AI_RESULT", target: "BRG-1234 → khách hàng ABC", timestamp: "2025-07-14T10:15:00Z" },
  { id: "a3", user: "vana@company.com", action: "CREATE_QUOTE", target: "BQ-20250714-001", timestamp: "2025-07-14T09:45:00Z" },
  { id: "a4", user: "minhc@company.com", action: "DEACTIVATE_USER", target: "ducd@company.com", timestamp: "2025-07-13T14:00:00Z" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function loadAiConfig(): AiConfig {
  try { return { ...DEFAULT_AI, ...JSON.parse(localStorage.getItem(AI_CONFIG_KEY) ?? "{}") as Partial<AiConfig> }; } catch { return DEFAULT_AI; }
}
function saveAiConfig(c: AiConfig) { localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(c)); }

function loadSystemConfig(): SystemConfig {
  try { return { ...DEFAULT_SYSTEM_CONFIG, ...JSON.parse(localStorage.getItem(SYSTEM_CONFIG_KEY) ?? "{}") as Partial<SystemConfig> }; } catch { return DEFAULT_SYSTEM_CONFIG; }
}
function saveSystemConfig(c: SystemConfig) { localStorage.setItem(SYSTEM_CONFIG_KEY, JSON.stringify(c)); }

function loadLicenseConfig(): LicenseConfig {
  try { return { ...DEFAULT_LICENSE_CONFIG, ...JSON.parse(localStorage.getItem(LICENSE_CONFIG_KEY) ?? "{}") as Partial<LicenseConfig> }; } catch { return DEFAULT_LICENSE_CONFIG; }
}
function saveLicenseConfig(c: LicenseConfig) { localStorage.setItem(LICENSE_CONFIG_KEY, JSON.stringify(c)); }

function loadAudit(): AuditEntry[] {
  try { return JSON.parse(localStorage.getItem(AUDIT_KEY) ?? "null") as AuditEntry[] ?? DEFAULT_AUDIT; } catch { return DEFAULT_AUDIT; }
}

const ROLES = ["USER", "SALES", "SENIOR_SALES", "ADMIN", "SUPER_ADMIN"];

const ROLE_COLOR: Record<string, string> = {
  USER: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  SALES: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  SENIOR_SALES: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  ADMIN: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  SUPER_ADMIN: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

// ---------------------------------------------------------------------------
// Tab: Người dùng
// ---------------------------------------------------------------------------
function UsersTab(): JSX.Element {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("USER");

  const loadUserList = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.auth.listUsers();
      const mapped: AppUser[] = result.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.roles[0] ?? "USER",
        lastLogin: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
        active: user.active,
      }));
      setUsers(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không tải được danh sách người dùng";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUserList();
  }, []);

  const toggleActive = async (id: string) => {
    const current = users.find((user) => user.id === id);
    if (!current) {
      return;
    }
    try {
      await window.electronAPI.auth.updateUser({ id, active: !current.active });
      await loadUserList();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không cập nhật được trạng thái người dùng";
      setError(message);
    }
  };

  const changeRole = async (id: string, role: string) => {
    try {
      await window.electronAPI.auth.updateUser({ id, role: role as any });
      await loadUserList();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không cập nhật được vai trò";
      setError(message);
    }
  };

  const createUser = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword) {
      setError("Vui lòng nhập đầy đủ tên, email và mật khẩu");
      return;
    }

    try {
      await window.electronAPI.auth.createUser({
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword,
        role: newRole as any,
      });
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("USER");
      await loadUserList();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không tạo được người dùng";
      setError(message);
    }
  };

  return (
    <div className="space-y-4">
      {saved && <p className="text-xs text-emerald-600">✓ Đã lưu thay đổi</p>}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <p className="text-xs text-slate-500">Quản trị có thể tạo tài khoản nhân viên và phân quyền ngay trong ứng dụng.</p>

      <div className="grid gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-5 dark:border-slate-700">
        <input
          className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="Họ tên"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="Email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
        />
        <input
          className="rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          type="password"
          placeholder="Mật khẩu"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <select
          className="rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
          value={newRole}
          onChange={(e) => setNewRole(e.target.value)}
        >
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button
          type="button"
          onClick={createUser}
          className="rounded bg-sky-600 px-3 py-1 text-sm text-white hover:bg-sky-700"
        >
          + Thêm
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Đang tải danh sách người dùng...</p>
      ) : (
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700">
              <th className="pb-2 pr-4">Tên</th>
              <th className="pb-2 pr-4">Email</th>
              <th className="pb-2 pr-4">Vai trò</th>
              <th className="pb-2 pr-4">Đăng nhập lần cuối</th>
              <th className="pb-2">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td className="py-2.5 pr-4 font-medium">{u.name}</td>
                <td className="py-2.5 pr-4 text-slate-500">{u.email}</td>
                <td className="py-2.5 pr-4">
                  <select
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value)}
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="py-2.5 pr-4 text-xs text-slate-400">
                  {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString("vi-VN") : "—"}
                </td>
                <td className="py-2.5">
                  <button
                    type="button"
                    onClick={() => toggleActive(u.id)}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}
                  >
                    {u.active ? "Hoạt động" : "Vô hiệu"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
      <p className="text-xs text-slate-400">Bảng hiển thị {users.length} người dùng · {users.filter((u) => u.active).length} đang hoạt động</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Cấu hình AI
// ---------------------------------------------------------------------------
function AiConfigTab(): JSX.Element {
  const [cfg, setCfg] = useState<AiConfig>(loadAiConfig);
  const [saved, setSaved] = useState(false);

  const save = () => {
    saveAiConfig(cfg);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const rangeField = (label: string, key: keyof AiConfig, min: number, max: number, unit: string) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm font-semibold text-sky-600">{cfg[key] as number}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={cfg[key] as number}
        onChange={(e) => setCfg((c) => ({ ...c, [key]: Number(e.target.value) }))}
        className="w-full accent-sky-600"
      />
      <div className="flex justify-between text-xs text-slate-400"><span>{min}{unit}</span><span>{max}{unit}</span></div>
    </div>
  );

  return (
    <div className="max-w-lg space-y-5">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 p-4 dark:border-slate-700">
        <div>
          <p className="font-medium">Bật gợi ý AI</p>
          <p className="text-xs text-slate-500">Cho phép AI đề xuất phụ tùng thay thế từ nguồn bên ngoài</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={cfg.enabled}
          onClick={() => setCfg((c) => ({ ...c, enabled: !c.enabled }))}
          className={`relative h-6 w-11 rounded-full transition-colors ${cfg.enabled ? "bg-sky-600" : "bg-slate-300 dark:bg-slate-600"}`}
        >
          <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${cfg.enabled ? "translate-x-5" : ""}`} />
        </button>
      </div>

      {rangeField("Ngưỡng hiển thị kết quả", "confidenceThreshold", 10, 90, "%")}
      {rangeField("Ngưỡng yêu cầu phê duyệt", "requireApprovalThreshold", 50, 95, "%")}
      {rangeField("Số kết quả tối đa / tìm kiếm", "maxResultsPerSearch", 1, 20, "")}

      <p className="text-xs text-slate-400">
        Kết quả có độ tin cậy &lt; {cfg.confidenceThreshold}% bị ẩn.{" "}
        Kết quả &lt; {cfg.requireApprovalThreshold}% yêu cầu phê duyệt SENIOR_SALES+.
      </p>

      <button
        type="button"
        onClick={save}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700"
      >
        {saved ? "✓ Đã lưu" : "Lưu cấu hình"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Thống kê / Sync
// ---------------------------------------------------------------------------
function SyncStatsTab(): JSX.Element {
  const { stats, syncQueue, lastSyncTime, clearSyncQueue } = useOfflineStore();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Đã đồng bộ", value: stats.totalSynced, color: "text-emerald-600" },
          { label: "Thất bại", value: stats.totalFailed, color: "text-rose-600" },
          { label: "Xung đột", value: stats.totalConflicts, color: "text-amber-600" },
          { label: "Hàng đợi", value: syncQueue.length, color: "text-sky-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>
      {lastSyncTime && (
        <p className="text-xs text-slate-500">Đồng bộ lần cuối: {new Date(lastSyncTime).toLocaleString("vi-VN")}</p>
      )}
      {syncQueue.length > 0 && (
        <button
          type="button"
          onClick={clearSyncQueue}
          className="rounded-md border border-rose-300 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:border-rose-700"
        >
          Xóa toàn bộ hàng đợi ({syncQueue.length} mục)
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Cấu hình hệ thống
// ---------------------------------------------------------------------------
function SystemConfigTab(): JSX.Element {
  const [config, setConfig] = useState<SystemConfig>(loadSystemConfig);
  const [saved, setSaved] = useState(false);

  const save = () => {
    if (config.syncIntervalSeconds < 5) {
      window.alert("Chu kỳ đồng bộ tối thiểu là 5 giây.");
      return;
    }

    saveSystemConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-xl space-y-4">
      <label className="block text-sm">
        <span className="font-medium">API Base URL</span>
        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={config.apiBaseUrl} onChange={(e) => setConfig((prev) => ({ ...prev, apiBaseUrl: e.target.value }))} />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Chu kỳ đồng bộ (giây)</span>
        <input type="number" min={5} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={config.syncIntervalSeconds} onChange={(e) => setConfig((prev) => ({ ...prev, syncIntervalSeconds: Number(e.target.value) }))} />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Số ngày giữ cache offline</span>
        <input type="number" min={1} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={config.offlineCacheDays} onChange={(e) => setConfig((prev) => ({ ...prev, offlineCacheDays: Number(e.target.value) }))} />
      </label>
      <button type="button" onClick={save} className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700">
        {saved ? "✓ Đã lưu" : "Lưu cấu hình hệ thống"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Quản lý giấy phép
// ---------------------------------------------------------------------------
function LicenseManagementTab(): JSX.Element {
  const [config, setConfig] = useState<LicenseConfig>(loadLicenseConfig);
  const [saved, setSaved] = useState(false);

  const save = () => {
    saveLicenseConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-xl space-y-4">
      <label className="block text-sm">
        <span className="font-medium">License key</span>
        <input className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 font-mono dark:border-slate-700 dark:bg-slate-950" value={config.licenseKeyMasked} onChange={(e) => setConfig((prev) => ({ ...prev, licenseKeyMasked: e.target.value }))} />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Số máy kích hoạt tối đa</span>
        <input type="number" min={1} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={config.maxActivations} onChange={(e) => setConfig((prev) => ({ ...prev, maxActivations: Number(e.target.value) }))} />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Liên hệ hỗ trợ</span>
        <input type="email" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={config.supportContact} onChange={(e) => setConfig((prev) => ({ ...prev, supportContact: e.target.value }))} />
      </label>
      <button type="button" onClick={save} className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white hover:bg-sky-700">
        {saved ? "✓ Đã lưu" : "Lưu cấu hình giấy phép"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Nhật ký kiểm toán
// ---------------------------------------------------------------------------
function AuditLogTab(): JSX.Element {
  const [entries] = useState<AuditEntry[]>(loadAudit);
  const exportCsv = () => {
    const header = "Người dùng,Hành động,Đối tượng,Thời gian\n";
    const rows = entries.map((e) => `"${e.user}","${e.action}","${e.target.replace(/"/g, '""')}","${e.timestamp}"`).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Xuất CSV
        </button>
      </div>
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-medium">{e.user}</span>{" "}
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono dark:bg-slate-800">{e.action}</span>{" "}
                <span className="text-slate-500">{e.target}</span>
              </p>
            </div>
            <p className="shrink-0 text-xs text-slate-400">{new Date(e.timestamp).toLocaleString("vi-VN")}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
type TabId = "users" | "system" | "ai" | "license" | "sync" | "audit";

const TABS: { id: TabId; label: string }[] = [
  { id: "users", label: "Người dùng" },
  { id: "system", label: "Cấu hình hệ thống" },
  { id: "ai", label: "Cấu hình AI" },
  { id: "license", label: "Quản lý giấy phép" },
  { id: "sync", label: "Đồng bộ" },
  { id: "audit", label: "Nhật ký kiểm toán" },
];

export function AdminSettingsScreen(): JSX.Element {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabId>("users");

  if (!user || !user.roles.some((r) => ["ADMIN", "SUPER_ADMIN"].includes(r))) {
    return (
      <div className="rounded-xl border border-rose-300 bg-rose-50 p-6 dark:border-rose-800 dark:bg-rose-900/20">
        <p className="font-semibold text-rose-700 dark:text-rose-300">Không có quyền truy cập</p>
        <p className="mt-1 text-sm text-rose-600 dark:text-rose-400">Chức năng này chỉ dành cho ADMIN và SUPER_ADMIN.</p>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Quản trị hệ thống</h1>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          {user.roles[0] ?? "ADMIN"}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900/50" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            aria-selected={activeTab === t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white"
                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        {activeTab === "users" && <UsersTab />}
        {activeTab === "system" && <SystemConfigTab />}
        {activeTab === "ai" && <AiConfigTab />}
        {activeTab === "license" && <LicenseManagementTab />}
        {activeTab === "sync" && <SyncStatsTab />}
        {activeTab === "audit" && <AuditLogTab />}
      </div>
    </section>
  );
}
