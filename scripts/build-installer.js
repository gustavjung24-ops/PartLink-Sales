import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const rootDir = path.resolve(new URL("..", import.meta.url).pathname);
const desktopDir = path.join(rootDir, "apps", "desktop");
const args = new Set(process.argv.slice(2));
const publish = args.has("--publish");
const unsigned = args.has("--unsigned");
const targetFlags = [];

if (args.has("--win")) {
  targetFlags.push("--win");
}

if (args.has("--mac")) {
  targetFlags.push("--mac");
}

if (targetFlags.length === 0) {
  if (process.platform === "darwin") {
    targetFlags.push("--mac");
  } else if (process.platform === "win32") {
    targetFlags.push("--win");
  } else {
    console.error("[build-installer] Unsupported platform. Use --win or --mac explicitly.");
    process.exit(1);
  }
}

const requiredFiles = [
  path.join(desktopDir, "electron-builder.json"),
  path.join(desktopDir, "build", "windows", "app.ico"),
  path.join(desktopDir, "build", "windows", "installer.ico"),
  path.join(desktopDir, "build", "windows", "uninstaller.ico"),
  path.join(desktopDir, "build", "windows", "header.ico"),
  path.join(desktopDir, "build", "mac", "entitlements.mac.plist"),
  path.join(desktopDir, "build", "mac", "entitlements.mac.inherit.plist"),
];

const missingFiles = requiredFiles.filter((filePath) => !existsSync(filePath));
if (missingFiles.length > 0) {
  console.error("[build-installer] Missing build resources:");
  for (const filePath of missingFiles) {
    console.error(` - ${path.relative(rootDir, filePath)}`);
  }
  process.exit(1);
}

function validateSigning() {
  if (unsigned) {
    console.warn("[build-installer] Running unsigned build. Do not use artifacts for commercial release.");
    return;
  }

  if (targetFlags.includes("--win")) {
    const hasWindowsSigning = Boolean(
      process.env.WIN_CSC_LINK ||
      process.env.CSC_LINK ||
      process.env.SPARELINK_WINDOWS_SIGNING_MODE === "ev-token"
    );

    if (!hasWindowsSigning) {
      console.error("[build-installer] Windows signing is mandatory. Provide WIN_CSC_LINK/CSC_LINK or set SPARELINK_WINDOWS_SIGNING_MODE=ev-token for EV token based signing.");
      process.exit(1);
    }
  }

  if (targetFlags.includes("--mac")) {
    const requiredEnv = ["APPLE_ID", "APPLE_APP_SPECIFIC_PASSWORD", "APPLE_TEAM_ID"];
    const missingEnv = requiredEnv.filter((name) => !process.env[name]);
    if (missingEnv.length > 0) {
      console.error(`[build-installer] Missing macOS notarization environment variables: ${missingEnv.join(", ")}`);
      process.exit(1);
    }
  }

  if (publish && !process.env.SPARELINK_UPDATE_URL) {
    console.error("[build-installer] SPARELINK_UPDATE_URL is required when --publish is used.");
    process.exit(1);
  }
}

function run(command, commandArgs, cwd = rootDir) {
  const result = spawnSync(command, commandArgs, {
    cwd,
    env: process.env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

validateSigning();

console.log(`[build-installer] Targets: ${targetFlags.join(" ")}`);
console.log(`[build-installer] Publish mode: ${publish ? "always" : "never"}`);

run("pnpm", ["--filter", "@sparelink/desktop", "build"]);
run(
  "pnpm",
  [
    "--filter",
    "@sparelink/desktop",
    "exec",
    "electron-builder",
    "--config",
    "electron-builder.json",
    ...targetFlags,
    "--publish",
    publish ? "always" : "never",
  ],
  desktopDir
);

console.log("[build-installer] Build completed.");
console.log("[build-installer] Next steps:");
console.log("  1. Verify code signing on each generated artifact.");
console.log("  2. Upload installers and latest.yml to the update host.");
console.log("  3. Complete release checklist in release/RELEASE_CHECKLIST.md.");
