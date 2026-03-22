import { useEffect, useState } from "react";

/**
 * UpdateNotifier — shows a non-blocking banner when electron-updater
 * emits update events via the preload bridge.
 *
 * The preload script is expected to expose window.electronUpdater
 * (an EventEmitter-like interface) — if absent, this component is a no-op.
 */

type UpdateStatus =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "available"; version: string }
  | { phase: "not-available" }
  | { phase: "downloading"; percent: number }
  | { phase: "ready" }
  | { phase: "error"; message: string };

declare global {
  interface Window {
    electronUpdater?: {
      on: (event: string, listener: (...args: unknown[]) => void) => void;
      off: (event: string, listener: (...args: unknown[]) => void) => void;
      checkForUpdates: () => void;
      quitAndInstall: () => void;
    };
  }
}

export function UpdateNotifier(): JSX.Element | null {
  const [status, setStatus] = useState<UpdateStatus>({ phase: "idle" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const updater = window.electronUpdater;
    if (!updater) return; // Running in browser dev mode

    const onChecking = () => setStatus({ phase: "checking" });
    const onAvailable = (...args: unknown[]) => {
      const info = args[0] as { version?: string } | undefined;
      setStatus({ phase: "available", version: info?.version ?? "mới nhất" });
      setDismissed(false);
    };
    const onNotAvailable = () => setStatus({ phase: "not-available" });
    const onProgress = (...args: unknown[]) => {
      const p = args[0] as { percent?: number } | undefined;
      setStatus({ phase: "downloading", percent: Math.round(p?.percent ?? 0) });
    };
    const onDownloaded = () => { setStatus({ phase: "ready" }); setDismissed(false); };
    const onError = (...args: unknown[]) => {
      const err = args[0] as Error | undefined;
      setStatus({ phase: "error", message: err?.message ?? "Lỗi cập nhật không xác định" });
    };

    updater.on("checking-for-update", onChecking);
    updater.on("update-available", onAvailable);
    updater.on("update-not-available", onNotAvailable);
    updater.on("download-progress", onProgress);
    updater.on("update-downloaded", onDownloaded);
    updater.on("error", onError);

    // Trigger check on mount (only in packaged app — electron-updater handles that guard)
    updater.checkForUpdates();

    return () => {
      updater.off("checking-for-update", onChecking);
      updater.off("update-available", onAvailable);
      updater.off("update-not-available", onNotAvailable);
      updater.off("download-progress", onProgress);
      updater.off("update-downloaded", onDownloaded);
      updater.off("error", onError);
    };
  }, []);

  // Don't render anything for non-actionable states
  if (dismissed || status.phase === "idle" || status.phase === "checking" || status.phase === "not-available") {
    return null;
  }

  const isReady = status.phase === "ready";
  const isError = status.phase === "error";
  const isDownloading = status.phase === "downloading";

  const bannerCls = isReady
    ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
    : isError
    ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-700 dark:bg-rose-900/30 dark:text-rose-200"
    : "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-200";

  return (
    <div
      role="alert"
      className={`fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${bannerCls}`}
    >
      <div className="flex-1 text-sm">
        {status.phase === "available" && (
          <>
            <p className="font-semibold">Có phiên bản mới: {status.version}</p>
            <p className="text-xs opacity-80">Đang chuẩn bị tải xuống...</p>
          </>
        )}
        {isDownloading && (
          <>
            <p className="font-semibold">Đang tải bản cập nhật... {status.percent}%</p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sky-200 dark:bg-sky-800">
              <div className="h-1.5 rounded-full bg-sky-600 transition-all" style={{ width: `${status.percent}%` }} />
            </div>
          </>
        )}
        {isReady && (
          <>
            <p className="font-semibold">Sẵn sàng cài đặt cập nhật</p>
            <p className="mt-1 text-xs opacity-80">Hãy lưu công việc trước khi khởi động lại.</p>
            <button
              type="button"
              className="mt-2 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              onClick={() => window.electronUpdater?.quitAndInstall()}
            >
              Khởi động lại để cập nhật
            </button>
          </>
        )}
        {isError && (
          <>
            <p className="font-semibold">Lỗi kiểm tra cập nhật</p>
            <p className="mt-0.5 text-xs opacity-80">{status.message}</p>
          </>
        )}
      </div>
      <button
        type="button"
        aria-label="Đóng thông báo"
        className="shrink-0 opacity-60 hover:opacity-100"
        onClick={() => setDismissed(true)}
      >
        ✕
      </button>
    </div>
  );
}
