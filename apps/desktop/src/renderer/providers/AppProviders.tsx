import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ThemeProvider } from "./ThemeProvider";
import { AuthProvider } from "./AuthProvider";
import { queryClient } from "../lib/queryClient";
import { SyncManager } from "../services/SyncManager";
import { useOfflineStore } from "../stores/offlineStore";
import { UpdateNotifier } from "../components/UpdateNotifier";

const syncManager = new SyncManager();

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps): JSX.Element {
  const isOnline = useOfflineStore((state) => state.isOnline);

  useEffect(() => {
    if (isOnline) {
      syncManager.startAutoSync();
    } else {
      syncManager.stopAutoSync();
    }

    return () => syncManager.stopAutoSync();
  }, [isOnline]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <UpdateNotifier />
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
