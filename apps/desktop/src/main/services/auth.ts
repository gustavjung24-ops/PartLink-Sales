import { app } from "electron";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  type AuthLoginPayload,
  type AuthLoginResult,
  type AuthManagedUser,
  type AuthRefreshResult,
  type AuthSetupStatus,
  type AuthUser,
  type CreateInitialAdminPayload,
  type CreateManagedUserPayload,
  type PasswordResetResult,
  type UpdateManagedUserPayload,
} from "@/shared/electronApi";
import { secureSessionStore } from "./secureSessionStore";

interface PersistedUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  roles: AuthUser["roles"];
  active: boolean;
  lastLoginAt: number | null;
  createdAt: number;
}

interface PersistedUserDb {
  users: PersistedUser[];
}

interface RefreshTokenState {
  userId: string;
  expiresAt: number;
  revoked: boolean;
}

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function hashPassword(plain: string): string {
  return createHash("sha256").update(plain).digest("hex");
}

function validatePassword(plain: string): void {
  if (plain.length < 8) {
    throw new Error("Mật khẩu cần ít nhất 8 ký tự");
  }
}

export class AuthService {
  private readonly refreshTokens = new Map<string, RefreshTokenState>();
  private readonly usersFilePath = path.join(app.getPath("userData"), "auth", "users.local.json");

  private async loadUsers(): Promise<PersistedUser[]> {
    try {
      const content = await readFile(this.usersFilePath, "utf-8");
      const parsed = JSON.parse(content) as PersistedUserDb;
      return Array.isArray(parsed.users) ? parsed.users : [];
    } catch {
      return [];
    }
  }

  private async saveUsers(users: PersistedUser[]): Promise<void> {
    const dir = path.dirname(this.usersFilePath);
    await mkdir(dir, { recursive: true });
    const payload: PersistedUserDb = { users };
    await writeFile(this.usersFilePath, JSON.stringify(payload, null, 2), "utf-8");
  }

  private toAuthUser(record: PersistedUser): AuthUser {
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      roles: record.roles,
    };
  }

  private toManagedUser(record: PersistedUser): AuthManagedUser {
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      roles: record.roles,
      active: record.active,
      lastLoginAt: record.lastLoginAt,
    };
  }

  private issueAccessToken(user: PersistedUser): AuthRefreshResult {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + ACCESS_TOKEN_TTL_MS;
    const tokenPayload = `${user.id}.${expiresAt}.${randomBytes(16).toString("hex")}`;

    return {
      accessToken: tokenPayload,
      expiresAt,
      expiresIn: Math.floor((expiresAt - issuedAt) / 1000),
    };
  }

  private issueRefreshToken(user: PersistedUser): string {
    const token = `${user.id}.rf.${randomBytes(20).toString("hex")}`;
    this.refreshTokens.set(token, {
      userId: user.id,
      expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
      revoked: false,
    });

    return token;
  }

  private async findUserById(id: string): Promise<PersistedUser> {
    const users = await this.loadUsers();
    const user = users.find((item) => item.id === id && item.active);
    if (!user) {
      throw new Error("Tài khoản không tồn tại");
    }
    return user;
  }

  /** Returns the expiry (Unix ms) of a refresh token, or null if not registered/expired. */
  getRefreshTokenExpiry(refreshToken: string): number | null {
    return this.refreshTokens.get(refreshToken)?.expiresAt ?? null;
  }

  async getSetupStatus(): Promise<AuthSetupStatus> {
    const users = await this.loadUsers();
    return {
      hasUsers: users.length > 0,
      userCount: users.length,
    };
  }

  async createInitialAdmin(payload: CreateInitialAdminPayload): Promise<AuthManagedUser> {
    const users = await this.loadUsers();
    if (users.length > 0) {
      throw new Error("Hệ thống đã có tài khoản. Không thể tạo ADMIN đầu tiên.");
    }

    const email = normalizeEmail(payload.email);
    validatePassword(payload.password);

    const admin: PersistedUser = {
      id: randomUUID(),
      name: payload.name.trim() || "System Admin",
      email,
      passwordHash: hashPassword(payload.password),
      roles: ["ADMIN"],
      active: true,
      lastLoginAt: null,
      createdAt: Date.now(),
    };

    await this.saveUsers([admin]);
    return this.toManagedUser(admin);
  }

  async listUsers(): Promise<AuthManagedUser[]> {
    const users = await this.loadUsers();
    return users
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((user) => this.toManagedUser(user));
  }

  async createUser(payload: CreateManagedUserPayload): Promise<AuthManagedUser> {
    const users = await this.loadUsers();
    if (users.length === 0) {
      throw new Error("Cần tạo ADMIN đầu tiên trước khi thêm nhân viên.");
    }

    const email = normalizeEmail(payload.email);
    if (users.some((user) => user.email === email)) {
      throw new Error("Email đã tồn tại");
    }

    validatePassword(payload.password);

    const user: PersistedUser = {
      id: randomUUID(),
      name: payload.name.trim(),
      email,
      passwordHash: hashPassword(payload.password),
      roles: [payload.role],
      active: true,
      lastLoginAt: null,
      createdAt: Date.now(),
    };

    users.push(user);
    await this.saveUsers(users);
    return this.toManagedUser(user);
  }

  async updateUser(payload: UpdateManagedUserPayload): Promise<AuthManagedUser> {
    const users = await this.loadUsers();
    const index = users.findIndex((user) => user.id === payload.id);
    if (index === -1) {
      throw new Error("Không tìm thấy người dùng");
    }

    if (payload.active === false) {
      const isAdmin = users[index].roles.includes("ADMIN") || users[index].roles.includes("SUPER_ADMIN");
      if (isAdmin) {
        const activeAdmins = users.filter(
          (user) => user.active && (user.roles.includes("ADMIN") || user.roles.includes("SUPER_ADMIN"))
        );
        if (activeAdmins.length <= 1) {
          throw new Error("Phải giữ lại ít nhất 1 tài khoản quản trị đang hoạt động.");
        }
      }
    }

    const updated: PersistedUser = {
      ...users[index],
      roles: payload.role ? [payload.role] : users[index].roles,
      active: payload.active ?? users[index].active,
    };

    users[index] = updated;
    await this.saveUsers(users);
    return this.toManagedUser(updated);
  }

  async login(payload: AuthLoginPayload): Promise<AuthLoginResult> {
    const users = await this.loadUsers();
    if (users.length === 0) {
      throw new Error("Hệ thống chưa có tài khoản. Hãy tạo ADMIN đầu tiên.");
    }

    const email = normalizeEmail(payload.email);
    const passwordHash = hashPassword(payload.password);
    const user = users.find((item) => item.email === email && item.active);

    if (!user || user.passwordHash !== passwordHash) {
      throw new Error("Email hoặc mật khẩu không đúng");
    }

    user.lastLoginAt = Date.now();
    await this.saveUsers(users);

    const refreshToken = this.issueRefreshToken(user);
    const access = this.issueAccessToken(user);
    const now = Date.now();

    return {
      user: this.toAuthUser(user),
      refreshToken,
      issuedAt: now,
      ...access,
    };
  }

  async refresh(refreshToken: string): Promise<AuthRefreshResult> {
    let tokenState = this.refreshTokens.get(refreshToken);

    if (!tokenState) {
      const stored = await secureSessionStore.loadStoredPayload();
      if (stored?.session.refreshToken === refreshToken) {
        const expiry = stored.refreshTokenExpiry ?? 0;
        if (Date.now() < expiry) {
          const userId = refreshToken.split(".rf.")[0];
          tokenState = { userId, expiresAt: expiry, revoked: false };
          this.refreshTokens.set(refreshToken, tokenState);
        }
      }
    }

    if (!tokenState || tokenState.revoked) {
      throw new Error("Phiên làm việc không hợp lệ");
    }

    if (Date.now() >= tokenState.expiresAt) {
      this.refreshTokens.delete(refreshToken);
      throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
    }

    const user = await this.findUserById(tokenState.userId);
    return this.issueAccessToken(user);
  }

  async me(accessToken: string): Promise<AuthUser | null> {
    const userId = accessToken.split(".")[0];
    if (!userId) {
      return null;
    }

    try {
      const user = await this.findUserById(userId);
      return this.toAuthUser(user);
    } catch {
      return null;
    }
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const existing = this.refreshTokens.get(refreshToken);
    if (existing) {
      this.refreshTokens.set(refreshToken, {
        ...existing,
        revoked: true,
      });
    }
  }

  async requestPasswordReset(email: string): Promise<PasswordResetResult> {
    const normalized = normalizeEmail(email);
    const users = await this.loadUsers();
    const exists = users.some((item) => item.email === normalized);

    if (!exists) {
      return {
        sent: true,
        message: "Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu sẽ được gửi trong vài phút.",
      };
    }

    return {
      sent: true,
      message: "Đã gửi hướng dẫn đặt lại mật khẩu tới email của bạn.",
    };
  }
}

export const authService = new AuthService();
