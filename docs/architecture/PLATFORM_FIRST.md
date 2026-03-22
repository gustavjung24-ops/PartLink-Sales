# Platform First, Business Logic Second - Architecture Guide

## 🎯 Nguyên tắc Core

**"Platform First, Business Logic Second"** là mô hình xây dựng ứng dụng desktop Electron theo thứ tự tầng:

```
┌─────────────────────────────────────────┐
│ 3️⃣ BUSINESS SCREENS                    │ (React Pages, Components)
│    └─ Sử dụng Platform Layer contracts │
├─────────────────────────────────────────┤
│ 2️⃣ REACT FOUNDATION                   │ (Providers, Stores, Query)
│    └─ Sử dụng IPC/REST contracts      │
├─────────────────────────────────────────┤
│ 1️⃣ ELECTRON SHELL                     │ (Main, Preload, IPC)
│    └─ Định nghĩa contract trước       │
└─────────────────────────────────────────┘
```

---

## 📋 Tầng 1️⃣: ELECTRON SHELL - Platform Layer

**Nhiệm vụ:** Thiết lập nền tảng Electron với IPC contracts rõ ràng

### File Cấu Trúc

```
apps/desktop/src/
├── main/
│   ├── index.ts                 (BrowserWindow, app lifecycle)
│   └── ipc/
│       ├── handlers.ts          (IPC handlers, registered via withErrorHandling)
│       └── utils.ts             ⭐ (withErrorHandling wrapper, IPC_HANDLERS)
├── preload/
│   └── index.ts                 ⭐ (IPC bridge, response unwrapping)
├── shared/
│   └── electronApi.ts           ⭐ (IPC contracts, types)
└── renderer/
    └── global.d.ts              (TypeScript declarations)
```

### IPC Contract Definition

**File:** [apps/desktop/src/shared/electronApi.ts](apps/desktop/src/shared/electronApi.ts)

```typescript
// ✅ CORRECT - Typed IPC channels
export const IPC_CHANNELS = {
  AUTH_LOGIN: "auth:login",
  WINDOW_MINIMIZE: "window:minimize",
  // ... all channels defined here
};

// ✅ Platform contract - standardized response
export interface IpcResponse<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
  timestamp: number;
}
```

### Error Handling Pattern

**File:** [apps/desktop/src/main/ipc/utils.ts](apps/desktop/src/main/ipc/utils.ts)

```typescript
// Platform Layer error handling - automatic for all handlers
withErrorHandling<Payload, Response>(channel, handler);

// ✅ All IPC calls return standardized IpcResponse<T>
// ✅ Errors automatically wrapped in response format
// ✅ Debug logging available via DEBUG_IPC env var
```

### Handler Registration

**File:** [apps/desktop/src/main/ipc/handlers.ts](apps/desktop/src/main/ipc/handlers.ts)

```typescript
// ✅ All handlers use withErrorHandling wrapper
withErrorHandling<AuthLoginPayload, { accessToken: string }>(
  IPC_CHANNELS.AUTH_LOGIN,
  async (_event, payload) => {
    // Business logic here - just return data
    return { accessToken: "..." };
  }
);
```

### Preload Bridge

**File:** [apps/desktop/src/preload/index.ts](apps/desktop/src/preload/index.ts)

```typescript
// ✅ adapter unwrapIpcResponse - converts IpcResponse<T> to T or throws
async function invokeIpc<T>(channel: string, payload?): Promise<T> {
  const response = await ipcRenderer.invoke(channel, payload);
  return unwrapIpcResponse<T>(response); // Throws on error
}

// ✅ Renderer receives typed data, not raw IpcResponse
window.electronAPI.auth.login(...) // Returns AuthLoginResult, not IpcResponse
```

---

## 📋 Tầng 2️⃣: REACT FOUNDATION - Application Layer

**Nhiệm vụ:** State management, providers, query clients - tất cả sử dụng Platform Layer contracts

### File Cấu Trúc

```
apps/desktop/src/renderer/
├── lib/
│   └── queryClient.ts           (React Query, offline-first config)
├── providers/
│   ├── AppProviders.tsx         (Combine all providers)
│   └── ThemeProvider.tsx        (Theme logic)
├── stores/
│   ├── uiStore.ts              (UI state - Zustand)
│   └── offlineStore.ts         ⭐ (Offline management)
├── services/
│   └── SyncManager.ts          ⭐ (Sync queue coordination)
└── hooks/
    └── (Custom hooks will use Electron API + Zustand)
```

### Offline-First Store

**File:** [apps/desktop/src/renderer/stores/offlineStore.ts](apps/desktop/src/renderer/stores/offlineStore.ts)

```typescript
const useOfflineStore = create()(
  persist(
    (set, get) => ({
      // Connection state
      isOnline: boolean;
      setOnline: (online: boolean) => void;

      // Sync queue
      syncQueue: SyncQueueItem[];
      addToSyncQueue: (item) => void;
      getPendingSyncItems: () => SyncQueueItem[];

      // Machine context for sync
      machineContext: MachineContext | null;

      // Cache management
      cacheInvalidationTime: Record<string, number>;
      isCacheValid: (key: string, ttl: number) => boolean;
    }),
    { name: "sparelink-offline-store" }
  )
);
```

### Sync Manager

**File:** [apps/desktop/src/renderer/services/SyncManager.ts](apps/desktop/src/renderer/services/SyncManager.ts)

```typescript
const syncManager = new SyncManager({
  maxRetries: 3,
  retryDelayMs: 1000,
  batchSize: 10,
  conflictStrategy: "CLIENT_WINS",
});

// Auto-sync every 30 seconds when online
syncManager.startAutoSync();

// Handles:
// 1. Push pending changes to /api/sync/queue
// 2. Pull changes from /api/sync/pull
// 3. Resolve conflicts
// 4. Retry failed items with exponential backoff
```

### Query Client Config

**File:** [apps/desktop/src/renderer/lib/queryClient.ts](apps/desktop/src/renderer/lib/queryClient.ts)

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,           // 1 minute
      gcTime: 24 * 60 * 60 * 1000, // 24 hours
      networkMode: "offlineFirst", // Offline-first strategy
      retry: (failureCount) => failureCount < 3,
    },
  },
});

// Persist cache to localStorage via react-query-persist-client
```

---

## 📋 Tầng 3️⃣: BUSINESS SCREENS - Feature Layer

**Nhiệm vụ:** React components sử dụng Platform & Application layers

### Correct Pattern

```typescript
// ✅ CORRECT - Page component using Platform contracts
import { useQuery } from "@tanstack/react-query";
import { useOfflineStore } from "@/stores/offlineStore";

export function DashboardPage() {
  const { data: appInfo } = useQuery({
    queryKey: ["app"],
    queryFn: () => window.electronAPI.app.getInfo(),
  });

  const { isOnline } = useOfflineStore();

  return <div>{appInfo && <p>App: {appInfo.name}</p>}</div>;
}
```

### Anti-Patterns (❌ Sai)

```typescript
// ❌ WRONG - Direct IPC access without response handling
const result = await window.electronAPI.auth.login(payload);
if (!result.success) { /* ... */ }  // Wrong: response already unwrapped!

// ❌ WRONG - Accessing ipcRenderer directly
import { ipcRenderer } from "electron";  // ← Context isolation violation!

// ❌ WRONG - No error handling
try {
  await window.electronAPI.app.getInfo();  // ← Missing catch
}

// ❌ WRONG - New IPC channels without Platform Layer
ipcMain.handle("custom:event", ...) // ← Bypasses error handling, security
```

---

## 🏗️ API LAYER (Backend) - Planned

**File:** [apps/api/src/](apps/api/src/)

```
apps/api/src/
├── main.ts              (Fastify entry point - TODO)
├── types.ts             ⭐ (API contracts, error codes, types)
├── errors.ts            (Error handling utilities)
├── routes/
│   ├── auth.ts          (Login, logout, token refresh)
│   ├── parts.ts         (Part search, parse)
│   └── sync.ts          (Offline-first sync endpoints)
├── middleware/
│   ├── auth.ts          (JWT validation - TODO)
│   └── errors.ts        (Request/response formatters - TODO)
├── services/
│   ├── authService.ts   (JWT, password hashing - TODO)
│   └── partService.ts   (Part database logic - TODO)
└── database/
    ├── migrations/      (Schema changes - TODO)
    └── models/          (Prisma models - TODO)
```

### API Response Format

**File:** [apps/api/src/types.ts](apps/api/src/types.ts)

```typescript
// ✅ Standardized REST API response
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
  timestamp: number;
}

export enum ApiErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  INVALID_PAYLOAD = "INVALID_PAYLOAD",
  NOT_FOUND = "NOT_FOUND",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}
```

### API Routes Skeleton

**File:** [apps/api/src/routes/auth.ts](apps/api/src/routes/auth.ts)

```typescript
// ✅ Contracts defined BEFORE implementation
export interface AuthRoutes {
  loginContract: {
    request: AuthLoginPayload;
    response: AuthLoginResponse;
  };
  refreshContract: {
    request: { refreshToken: string };
    response: { accessToken: string; expiresIn: number };
  };
  // ...
}
```

---

## 📦 SHARED PACKAGE

**File:** [packages/shared/src/](packages/shared/src/)

```
packages/shared/src/
├── index.ts             ⭐ (Exports all public types)
├── types/
│   └── index.ts         (Domain models, shared types)
└── parsing/
    └── partCodeParser.ts ⭐ (Part code parsing logic)
```

### PartCodeParser Implementation

**Status:** ✅ Complete

Features:
- ✅ Parse multiple part code formats (TI, NXP, Motorola, generic)
- ✅ Identify manufacturer from prefix
- ✅ Categorize part type (IC, Resistor, etc.)
- ✅ Fuzzy matching with Levenshtein distance
- ✅ Validation logic
- ✅ Normalization

```typescript
const parser = new PartCodeParser();
const result = await parser.parse("SN74HC04N", "manual");
// Returns: { success, data: { partNumber, manufacturer, category } }
```

---

## 🔄 Data Flow - Platform First Architecture

### Scenario: User performs part search

```
1. USER INPUT (React Component)
   └─ Part search form

2. BUSINESS LOGIC (Search handler)
   └─ Format query, add to sync queue

3. PLATFORM CHECK (useOnlineStatus hook)
   ├─ IF ONLINE → Send to API
   │  └─ fetch("/api/parts/search") → ApiResponse<T>
   └─ IF OFFLINE → Query local cache
      └─ Zustand store + React Query cache

4. ERROR HANDLING (Preload layer)
   └─ If offline, queued for sync
   └─ When online, SyncManager processes queue

5. RESULT (React Query)
   └─ Component re-renders with data
```

### Scenario: IPC Communication (Minimize window)

```
1. REACT COMPONENT
   └─ User clicks minimize button

2. CALL IPC (Type-safe)
   └─ window.electronAPI.window.minimize()

3. PRELOAD LAYER
   └─ invokeIpc(IPC_CHANNELS.WINDOW_MINIMIZE)
   └─ ipcRenderer.invoke("window:minimize", undefined)

4. WRAPPED HANDLER (Platform Layer)
   └─ withErrorHandling catches errors, returns IpcResponse

5. MAIN PROCESS
   └─ getSenderWindow(event).minimize()

6. RESPONSE
   ├─ Success → { success: true, data: void }
   └─ Error → { success: false, error: { code, message } }

7. PRELOAD UNWRAP
   └─ unwrapIpcResponse: If success, return data; else throw

8. ERROR HANDLING (Component)
   └─ Try/catch or error boundary
```

---

## ✅ Implementation Checklist

### Phase 1: Platform Foundation (✅ DONE)

- [x] Fix shared package exports
- [x] Implement IPC error handling layer (withErrorHandling)
- [x] Create API skeleton with typed contracts
- [x] Add standardized response formats
- [x] Implement offline-first Zustand store
- [x] Create SyncManager for queue coordination
- [x] Complete PartCodeParser implementation

### Phase 2: React Foundation (🚧 IN PROGRESS)

- [ ] Integrate SyncManager into app lifecycle (useEffect in AppShell)
- [ ] Add offline status indicator UI
- [ ] Implement sync conflict UI
- [ ] Add mutation hooks for queue updates
- [ ] Create offline-first hooks (useQuery, useMutation)

### Phase 3: Business Screens (⏳ TODO)

- [ ] Create PartSearch page using Platform contracts
- [ ] Create Results page with sync state display
- [ ] Implement favorites management
- [ ] Add OCR/barcode input UI
- [ ] Create settings for sync strategy

### Phase 4: Backend API (⏳ TODO)

- [ ] Implement Fastify server skeleton
- [ ] Add JWT authentication
- [ ] Implement /api/auth/* endpoints
- [ ] Implement /api/parts/* endpoints
- [ ] Implement /api/sync/* endpoints
- [ ] Add database migrations
- [ ] Setup error logging

---

## 🛡️ Security Patterns

### IPC Security

```typescript
// ✅ Context Isolation Enabled
webPreferences: {
  contextIsolation: true,   // ← Separate context
  sandbox: true,            // ← Sandbox renderer
  nodeIntegration: false,   // ← No Node.js in renderer
  preload: preloadPath,     // ← Bridge via preload
}

// ✅ Typed Preload Bridge
const electronAPI = {
  auth: { login: (p) => invokeIpc(...) },  // ← Type-safe
  // No direct access to ipcRenderer
};
contextBridge.exposeInMainWorld("electronAPI", electronAPI);
```

### Error Information Leakage

```typescript
// ✅ Production: Hide details
if (!process.env.DEBUG_IPC) {
  response.error.details = undefined;  // ← Security
}

// ✅ Sanitize errors before sending to client
function sanitizeErrorForClient(error: unknown): string {
  if (error.message.includes("ENOENT")) return "File not found";
  return "An error occurred"; // Generic fallback
}
```

---

## 📚 Related Documentation

- [ARCHITECTURE_3_TIERS.md](./ARCHITECTURE_3_TIERS.md) - Detailed 3-tier architecture
- [OFFLINE_FIRST_STRATEGY.md](./OFFLINE_FIRST_STRATEGY.md) - Offline-first implementation guide
- [NAMING_CONVENTIONS.md](../NAMING_CONVENTIONS.md) - Code naming standards

---

## 🚀 Quick Start

### Running the application

```bash
# Install dependencies
pnpm install

# Development
pnpm -r dev

# Desktop app
pnpm --filter @sparelink/desktop dev

# Backend API
pnpm --filter @sparelink/api dev
```

### Adding a new IPC channel

1. **Define contract** in [electronApi.ts](apps/desktop/src/shared/electronApi.ts)
2. **Register handler** in [handlers.ts](apps/desktop/src/main/ipc/handlers.ts) using `withErrorHandling`
3. **Use in component** via `window.electronAPI.*` (automatically typed!)

### Adding a new API endpoint

1. **Define contract** in [routes/](apps/api/src/routes/)
2. **Implement handler** in [main.ts](apps/api/src/main.ts)
3. **Add to SyncManager** if offline-sensitive
4. **Test** with curl or Postman

---

## 📞 Support

For questions on Platform First architecture, refer to:
- IPC patterns: [apps/desktop/src/main/ipc/utils.ts](apps/desktop/src/main/ipc/utils.ts)
- API contracts: [apps/api/src/types.ts](apps/api/src/types.ts)
- Offline logic: [apps/desktop/src/renderer/stores/offlineStore.ts](apps/desktop/src/renderer/stores/offlineStore.ts)
