# Quy Ước Đặt Tên - SPARELINK

Tài liệu này định nghĩa các quy ước đặt tên nhất quán trong dự án SPARELINK để đảm bảo khả năng duy trì và tính nhất quán mã.

## 1. Cấu Trúc Mono Repo

**Quyết Định**: Sử dụng `apps/api` (không phải `apps/backend`)

**Lý Do**:
- "api" là thuật ngữ chung hơn
- Tương thích với tên gọi phổ biến (NextJS: "pages", Remix: "routes")
- Ngắn gọn hơn "backend"

**Cấu Trúc Chính Xác**:
```
sparelink/
├── apps/
│   ├── desktop/      # Desktop Electron app
│   └── api/          # Backend API server
├── packages/
│   └── shared/       # Shared types & utilities
├── docs/             # Documentation
├── scripts/          # Automation scripts
├── infra/            # Infrastructure configs
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

## 2. Tên Gói (Package Names)

**Format**: `@sparelink/{feature}`

```json
{
  "@sparelink/components": "UI components",
  "@sparelink/shared": "Shared types & utilities",
  "@sparelink/desktop": "Desktop app package",
  "@sparelink/api": "Backend API package"
}
```

**Không Sử Dụng**:
- ❌ `@partlink/...` (inconsistent with SPARELINK branding)
- ❌ `sparelink-desktop` (use scoped packages)
- ❌ `api` (without @sparelink scope)

## 3. Tên Tệp TypeScript

### 3.1 Tệp Thành Phần React

**Format**: `PascalCase.tsx` (Component files)

```
Good:
✓ Button.tsx
✓ UserProfile.tsx
✓ OrderList.tsx

Bad:
✗ button.tsx
✗ user-profile.tsx
✗ orderlist.tsx
```

### 3.2 Tệp Cục (Hooks)

**Format**: `use{Feature}Hook.ts` or `use{Feature}.ts`

```
Good:
✓ useOfflineState.ts
✓ useSyncQueue.ts
✓ useAuth.ts

Bad:
✗ offline-state.ts
✗ sync-queue-hook.ts
```

### 3.3 Tệp Dịch Vụ (Services)

**Format**: `{service}Service.ts` или `{service}.service.ts`

```
Good:
✓ OrderService.ts
✓ AuthService.ts
✓ SyncService.ts
✓ order.service.ts
✓ auth.service.ts

Bad:
✗ orderService.ts (inconsistent capitalization)
✗ order-service.ts (inconsistent style)
```

### 3.4 Tệp Kiểu (Types)

**Format**: `{entity}.types.ts` or `types/index.ts`

```
Good:
✓ order.types.ts
✓ user.types.ts
✓ types/index.ts       // Main types export

Bad:
✗ orderTypes.ts
✗ types.ts (too vague)
```

### 3.5 Tệp Kiểm Thử

**Format**: `{name}.test.ts` or `{name}.spec.ts`

```
Good:
✓ OrderService.test.ts
✓ utils.spec.ts
✓ partCodeParser.test.ts

Bad:
✗ OrderService_test.ts
✗ test.orderService.ts
```

### 3.6 Tệp Cấu Hình

**Format**: `{purpose}.config.ts` or `config/{name}.ts`

```
Good:
✓ vite.config.ts
✓ tsconfig.base.json
✓ config/database.ts
✓ config/auth.ts

Bad:
✗ viteConfig.ts
✗ auth-config.ts
```

## 4. Tên Biến & Hàm

### 4.1 Biến & Hằng Số

**Format**: 
- camelCase cho biến thông thường
- UPPER_SNAKE_CASE cho hằng số toàn cục

```typescript
// Variables
const userName = "John";
let isLoading = false;
const maxRetries = 5;

// Constants
const API_BASE_URL = "https://api.example.com";
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB
const SYNC_RETRY_INTERVAL = 5000; // 5 seconds
const DEFAULT_TIMEOUT = 30000; // 30 seconds
```

### 4.2 Hàm

**Format**: camelCase động từ

```typescript
// Functions
function parsePartCode(code: string): ParsedCode { }
const handleUserLogin = async (credentials) => { }
async function fetchOrders(): Promise<Order[]> { }
const validateEmail = (email: string): boolean => { }

// Predicates (return boolean)
function isValidCode(code: string): boolean { }
const hasPermission = (user: User): boolean => { }
```

### 4.3 Boolean Biến

**Tiền Tố**: `is`, `can`, `has`, `should`, `will`

```typescript
const isLoading = false;
const isOnline = navigator.onLine;
const canEdit = user.role === 'admin';
const hasError = error !== null;
const shouldRetry = retryCount < maxRetries;
const willSync = isOnline && queue.length > 0;
```

## 5. Tên Lớp (Classes)

**Format**: PascalCase (danh từ)

```typescript
class PartCodeParser { }
class SyncQueueManager { }
class ConflictResolver { }
class AuthenticationService { }
class OfflineStore { }

// Not:
✗ class partCodeParser { }
✗ class ParsingPart { }
```

## 6. Tên Enum

**Format**: PascalCase, với giá trị UPPER_SNAKE_CASE

```typescript
enum ResultType {
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
  PENDING = "PENDING",
  CACHED = "CACHED"
}

enum SyncStatus {
  PENDING = "PENDING",
  SYNCING = "SYNCING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED"
}

enum UserRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  STAFF = "STAFF"
}
```

## 7. Tên Interface

**Format**: PascalCase (danh từ), có thể bắt đầu bằng `I`

```typescript
// Option 1: No prefix
interface Order {
  id: string;
  total: number;
}

interface User {
  id: string;
  email: string;
}

// Option 2: With I prefix (less common in modern TypeScript)
interface IOrder { }
interface IUser { }

// Prefer Option 1 for this project
```

## 8. Tên Biến API & Database

### 8.1 Biến API (HTTP)

```typescript
// Route parameters
/api/orders/:orderId
/api/users/:userId/orders

// Query parameters
/api/parts?search=bearing&limit=10&offset=20
/api/sync/queue?since=2026-03-22T10:00:00Z

// Request body
{
  "partNumber": "ABC-123",
  "quantity": 5,
  "machineId": "device-uuid"
}

// Response
{
  "type": "success",
  "data": { },
  "timestamp": "2026-03-22T10:15:30Z",
  "id": "req-12345"
}
```

### 8.2 Cột Database

**Format**: snake_case

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  order_date TIMESTAMP,
  total_amount DECIMAL,
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL,
  part_id UUID NOT NULL,
  quantity INTEGER,
  unit_price DECIMAL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

## 9. Tên Thư Mục

**Format**: kebab-case (lower-case with hyphens)

```
apps/desktop/src/
├── components/
│   ├── order/
│   ├── product/
│   └── common/
├── pages/
├── hooks/
├── store/
├── services/
├── types/
├── utils/
├── assets/
└── styles/

apps/api/src/
├── routes/
├── controllers/
├── services/
├── middleware/
├── models/
├── repositories/
├── types/
└── config/
```

## 10. Git Branches

**Format**: `{type}/{description}`

```
feature/add-offline-sync
feature/implement-conflict-resolution
bugfix/fix-sync-queue-ordering
chore/update-dependencies
docs/add-architecture-guide
refactor/extract-sync-service
```

**Types**:
- `feature/` - New feature
- `bugfix/` - Bug fix
- `chore/` - Maintenance
- `refactor/` - Code refactoring
- `docs/` - Documentation
- `perf/` - Performance improvement
- `test/` - Test improvements

## 11. ID Định Danh

### 11.1 Entity IDs

**Format**: UUID v4 hoặc slug readable

```typescript
// Database IDs
user.id = "550e8400-e29b-41d4-a716-446655440000" // UUID

// Human-readable IDs
order.code = "ORD-2026-03-00001"      // Order number
part.sku = "BALL-BEARING-6205-C3"     // SKU

// Internal tracking
queue.id = "sync-queue-1234567890"
sync.machineId = "desktop-uuid-hash"
```

### 11.2 Request/Response IDs

```typescript
interface Request {
  id: string;              // "req-1234567890-ABCD"
  timestamp: string;       // ISO 8601
}

interface Response {
  id: string;              // echo of request.id
  timestamp: string;
  traceId?: string;        // For distributed tracing
}
```

## 12. Tên Constant & Config

**Format**: UPPER_SNAKE_CASE

```typescript
// URLs & Endpoints
const API_BASE_URL = "https://api.sparelink.com";
const SYNC_ENDPOINT = "/api/sync/queue";
const AUTH_ENDPOINT = "/api/auth/login";

// Timeouts & Intervals
const SYNC_TIMEOUT_MS = 30000;
const RETRY_INTERVAL_MS = 5000;
const SESSION_TIMEOUT_MS = 3600000; // 1 hour

// Limits
const MAX_SYNC_BATCH_SIZE = 100;
const MAX_CACHE_SIZE_MB = 100;
const MAX_RETRY_ATTEMPTS = 5;

// Feature Flags
const ENABLE_CONFLICT_RESOLUTION = true;
const ENABLE_LOCAL_ENCRYPTION = false;
```

## 13. Tên Commit

**Format**: `{type}: {description}`

```
feat: add offline-first sync queue
fix: resolve conflict detection bug
docs: update architecture documentation
refactor: extract sync service to package
test: add sync queue tests
chore: upgrade typescript version
```

## 14. Tên Env Variable

**Format**: UPPER_SNAKE_CASE, prefixed by app

```bash
# API Server
API_PORT=3000
API_DATABASE_URL="postgresql://..."
API_JWT_SECRET="secret-key"
API_LOG_LEVEL="info"

# Desktop App
DESKTOP_API_URL="https://api.sparelink.com"
DESKTOP_CACHE_SIZE="104857600"  # 100MB
DESKTOP_SYNC_INTERVAL="5000"

# Common
NODE_ENV=production
LOG_LEVEL=info
```

## 15. Test Naming

**Format**: Describe what is being tested

```typescript
describe("PartCodeParser", () => {
  describe("parse", () => {
    it("should parse valid part code from string", () => {});
    it("should return error for invalid format", () => {});
    it("should handle OCR with confidence score", () => {});
  });

  describe("validate", () => {
    it("should validate part number format", () => {});
    it("should reject malformed codes", () => {});
  });
});
```

## Cheatsheet Nhanh

| Item | Format | Example |
|------|--------|---------|
| Package | @sparelink/{name} | @sparelink/shared |
| Components | PascalCase.tsx | UserProfile.tsx |
| Services | PascalCase.ts | AuthService.ts |
| Hooks | use{Name}.ts | useAuth.ts |
| Variables | camelCase | userName |
| Constants | UPPER_SNAKE_CASE | API_BASE_URL |
| Types | {name}.types.ts | order.types.ts |
| Classes | PascalCase | class Parser { } |
| Enums | PascalCase | enum Status { } |
| Directories | kebab-case | components/order |
| Git branches | {type}/{desc} | feature/add-sync |
| Database columns | snake_case | user_id |
| API routes | /api/v1/{resource} | /api/v1/orders |
| Env variables | UPPER_SNAKE_CASE | API_BASE_URL |

## Enforcement

- **Linter**: ESLint với custom rules cho naming conventions
- **Pre-commit**: Husky + lint-staged để kiểm tra trước commit
- **CI/CD**: GitHub Actions workflow để enforce trên PR
- **Code Review**: Reviewer kiểm tra naming trong review process

## Ngoại Lệ

Được phép vi phạm quy ước trong trường hợp:
1. Legacy code integration
2. Third-party library compatibility
3. Industry standard conventions (ví dụ: React Hook rules)
4. Tài liệu cấp cao phê duyệt

**Ghi Chú**: Tất cả ngoại lệ phải được ghi lại với giải thích.
