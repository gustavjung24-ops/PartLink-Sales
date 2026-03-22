import { QueryClient } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 86_400_000,
      retry: 1,
      networkMode: "offlineFirst"
    }
  }
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "sparelink-query-cache"
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: 86_400_000
});
