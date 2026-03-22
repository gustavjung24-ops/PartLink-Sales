import { randomBytes } from "node:crypto";
import {
  type AuthLoginPayload,
  type AuthLoginResult,
  type AuthRefreshResult,
  type AuthUser,
  type PasswordResetResult,
} from "@/shared/electronApi";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  password: string;
  roles: AuthUser["roles"];
}

interface RefreshTokenState {
  userId: string;
  expiresAt: number;
  revoked: boolean;
}

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const USERS: UserRecord[] = [
  {
    id: "u_sales_01",
    name: "Nguyen Van User",
    email: "user@sparelink.local",
    password: "Password@123",
    roles: ["USER"],
  },
  {
    id: "u_senior_01",
    name: "Tran Thu Senior",
    email: "senior@sparelink.local",
    password: "Password@123",
    roles: ["SENIOR_SALES"],
  },
  {
    id: "u_admin_01",
    name: "Le Minh Admin",
    email: "admin@sparelink.local",
    password: "Password@123",
    roles: ["ADMIN"],
  },
  {
    id: "u_super_01",
    name: "Pham Thanh Super",
    email: "super@sparelink.local",
    password: "Password@123",
    roles: ["SUPER_ADMIN"],
  },
];

export class AuthService {
  private readonly refreshTokens = new Map<string, RefreshTokenState>();

  private toAuthUser(record: UserRecord): AuthUser {
    return {
      id: record.id,
      name: record.name,
      email: record.email,
      roles: record.roles,
    };
  }

  private findById(id: string): UserRecord {
    const user = USERS.find((item) => item.id === id);
    if (!user) {
      throw new Error("Tài khoản không tồn tại");
    }
    return user;
  }

  private issueAccessToken(user: UserRecord): AuthRefreshResult {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + ACCESS_TOKEN_TTL_MS;
    const tokenPayload = `${user.id}.${expiresAt}.${randomBytes(16).toString("hex")}`;

    return {
      accessToken: tokenPayload,
      expiresAt,
      expiresIn: Math.floor((expiresAt - issuedAt) / 1000),
    };
  }

  private issueRefreshToken(user: UserRecord): string {
    const token = `${user.id}.rf.${randomBytes(20).toString("hex")}`;
    this.refreshTokens.set(token, {
      userId: user.id,
      expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
      revoked: false,
    });

    return token;
  }

  async login(payload: AuthLoginPayload): Promise<AuthLoginResult> {
    const email = payload.email.trim().toLowerCase();
    const user = USERS.find((item) => item.email.toLowerCase() === email);

    if (!user || user.password !== payload.password) {
      throw new Error("Email hoặc mật khẩu không đúng");
    }

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
    const tokenState = this.refreshTokens.get(refreshToken);
    if (!tokenState || tokenState.revoked) {
      throw new Error("Phiên làm việc không hợp lệ");
    }

    if (Date.now() >= tokenState.expiresAt) {
      this.refreshTokens.delete(refreshToken);
      throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
    }

    const user = this.findById(tokenState.userId);
    return this.issueAccessToken(user);
  }

  async me(accessToken: string): Promise<AuthUser | null> {
    const userId = accessToken.split(".")[0];
    if (!userId) {
      return null;
    }

    try {
      const user = this.findById(userId);
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
    const normalized = email.trim().toLowerCase();
    const exists = USERS.some((item) => item.email.toLowerCase() === normalized);

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
