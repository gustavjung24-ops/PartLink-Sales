import { useQuery } from "@tanstack/react-query";

async function fetchAppInfo() {
  return window.electronAPI.app.getInfo();
}

export function DashboardPage(): JSX.Element {
  const { data, isLoading } = useQuery({
    queryKey: ["app-info"],
    queryFn: fetchAppInfo
  });

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <h1 className="text-2xl font-semibold">Sales Console</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Nền tảng renderer đã sẵn sàng cho logic nghiệp vụ và đồng bộ offline-first.
      </p>
      {isLoading ? (
        <p className="text-sm">Loading app info...</p>
      ) : (
        <pre className="overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </section>
  );
}
