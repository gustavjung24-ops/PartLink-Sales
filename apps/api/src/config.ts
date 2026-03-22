/**
 * Application Configuration
 * Centralized environment variable handling with validation
 */

const requiredEnvVars = [
  "DATABASE_URL",
  "JWT_SECRET",
  "ENCRYPTION_KEY",
];

function getEnvVar(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (!value && !defaultValue) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value || defaultValue || "";
}

export const config = {
  // Environment
  isDev: process.env.NODE_ENV === "development",
  isProd: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",
  nodeEnv: process.env.NODE_ENV || "development",

  // Server
  port: parseInt(process.env.PORT || "3000", 10),
  host: process.env.HOST || "0.0.0.0",

  // Database
  databaseUrl: getEnvVar("DATABASE_URL"),

  // JWT
  jwtSecret: getEnvVar("JWT_SECRET"),
  jwtExpiry: process.env.JWT_EXPIRY || "24h",
  jwtRefreshSecret:
    process.env.NODE_ENV === "production"
      ? getEnvVar("JWT_REFRESH_SECRET")
      : getEnvVar("JWT_REFRESH_SECRET", "dev-refresh-secret-different"),
  jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || "7d",

  // Encryption
  encryptionKey: getEnvVar("ENCRYPTION_KEY", "demo-dev-key-not-for-production"),

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",

  // Logging
  logLevel: process.env.LOG_LEVEL || "info",

  // Feature flags
  enableAiSuggestions: process.env.ENABLE_AI_SUGGESTIONS !== "false",
  aiConfidenceThreshold: parseInt(process.env.AI_CONFIDENCE_THRESHOLD || "50", 10),
  requireApprovalThreshold: parseInt(process.env.REQUIRE_APPROVAL_THRESHOLD || "75", 10),
};

// Validate required variables
if (config.isProd) {
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`[Config] Missing required env var in production: ${envVar}`);
    }
  }
}

export const isProd = config.isProd;
export const isDev = config.isDev;
export const isTest = config.isTest;

export default config;
