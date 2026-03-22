import { useQuery } from "@tanstack/react-query";
import { Button } from "../components/ui/button";

export function SettingsPage(): JSX.Element {
  const { data: windowState } = useQuery({
    queryKey: ["window-state"],
    queryFn: () => window.electronAPI.window.getState()
  });

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <h2 className="text-xl font-semibold">Application Settings</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">Window controls are wired through typed IPC bridge.</p>
      <div className="flex gap-2">
        <Button onClick={() => window.electronAPI.window.minimize()} size="sm" type="button">
          Minimize
        </Button>
        <Button onClick={() => window.electronAPI.window.toggleMaximize()} size="sm" type="button" variant="outline">
          Toggle Maximize
        </Button>
      </div>
      <pre className="overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(windowState, null, 2)}</pre>
    </section>
  );
}
