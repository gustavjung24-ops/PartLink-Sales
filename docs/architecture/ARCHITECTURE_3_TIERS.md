# Kiến trúc SPARELINK - 3 Tầng

Tài liệu này mô tả kiến trúc hệ thống 3 tầng của SPARELINK, một ứng dụng giao dịch phụ tùng với chiến lược Offline-First.

## Tổng Quan Kiến Trúc

```
┌─────────────────────────────────────────────────────────────┐
│                      DESKTOP LAYER                          │
│    (Electron + React 18 + TypeScript + Vite)                │
│  - User Interface                                            │
│  - Local State Management (Zustand)                         │
│  - Offline-First Cache (SQLite)                             │
│  - Sync Queue Management                                    │
│  - Conflict Resolution                                      │
└──────────────────────────────────────────────────────────────┤
                             │                                    │
                    ↕ HTTP/REST API ↕                           │
                             │                                    │
┌──────────────────────────────────────────────────────────────┤
│                      BACKEND API LAYER                        │
│  (Node.js 20 LTS + TypeScript + Fastify + PostgreSQL)       │
│  - RESTful API Endpoints                                     │
│  - Authentication & Authorization (JWT)                     │
│  - Data Validation (Zod)                                     │
│  - Logging (Pino)                                            │
│  - Conflict Resolution Logic                                 │
│  - Data Persistence                                          │
└──────────────────────────────────────────────────────────────┤
                             │                                    │
                    ↕ Database Protocol ↕                       │
                             │                                    │
┌──────────────────────────────────────────────────────────────┤
│                     DATABASE LAYER                            │
│         (PostgreSQL 15+ + Prisma ORM)                        │
│  - Relational Data Storage                                   │
│  - Data Integrity & Consistency                             │
│  - Backup & Recovery                                         │
│  - Indexing & Performance Optimization                       │
└──────────────────────────────────────────────────────────────┘

     ┌─────────────────────────────────────────┐
     │    SHARED PACKAGES (@sparelink/shared)   │
     │  - Types & Interfaces                   │
     │  - Common Utilities                      │
     │  - Part Code Parser                      │
     │  - Sync Protocols                        │
     └─────────────────────────────────────────┘
```

## 1. Desktop Layer (Tầng Ứng Dụng Máy Tính)

### Công Nghệ
- **Framework UI**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Components**: Shadcn/ui
- **State Management**: Zustand
- **Data Querying**: React Query (@tanstack/react-query)
- **Desktop Runtime**: Electron
- **Local Database**: SQLite (better-sqlite3)
- **Machine Identification**: node-machine-id

### Trách Nhiệm
- Cung cấp giao diện người dùng cho bán hàng phụ tùng
- Quản lý trạng thái toàn cục ứng dụng
- Xử lý và phân tích mã phụ tùng (OCR, barcode)
- Lưu trữ dữ liệu cục bộ (cache, hàng đợi đồng bộ)
- Quản lý đồng bộ với máy chủ backend
- Xử lý xung đột khi kết nối trở lại

### Tính Năng Offline-First
- **SQLite Cache**: Lưu trữ dữ liệu người dùng cục bộ
- **Hàng Đợi Đồng Bộ**: Xếp hàng các thao tác khi offline
- **Xung Đột**: Phát hiện và giải quyết bằng chiến lược `server-wins` hoặc `client-wins`
- **Máy Định Danh**: Duy trì ID thiết bị duy nhất cho mục đích theo dõi

### Cấu Trúc Thư Mục
```
apps/desktop/
├── src/
│   ├── main/              # Main process (Electron)
│   ├── preload/           # Preload script
│   ├── renderer/          # React components & pages
│   ├── store/             # Zustand stores
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API & database services
│   ├── components/        # Reusable UI components
│   └── types/             # Local type definitions
├── vite.config.ts
├── tsconfig.json
├── package.json
└── dist/                  # Build output
```

## 2. Backend API Layer (Tầng API Backend)

### Công Nghệ
- **Runtime**: Node.js 20 LTS
- **Framework**: Fastify (hoặc NestJS tuỳ chọn)
- **Language**: TypeScript
- **ORM**: Prisma
- **Protocol**: HTTP/REST + JSON
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: Zod
- **Logging**: Pino (high-performance logger)
- **Database Client**: @prisma/client

### Trách Nhiệm
- Xử lý yêu cầu HTTP từ ứng dụng Desktop
- Quản lý xác thực & ủy quyền người dùng
- Xác thực dữ liệu đầu vào
- Xử lý logic kinh doanh
- Người dùng, phụ tùng, đơn hàng
- Giải quyết xung đột đồng bộ
- Ghi nhật ký các thao tác quan trọng

### Tính Năng Chính
- **RESTful API**: Endpoints tiêu chuẩn cho CRUD
- **JWT Authentication**: Xác thực người dùng an toàn
- **Zod Validation**: Xác thực lược đồ dữ liệu
- **Conflict Resolution**: Xử lý các thay đổi xung đột từ trong ngoài
- **Audit Logging**: Theo dõi tất cả các thay đổi dữ liệu

### Cấu Trúc Thư Mục
```
apps/api/
├── src/
│   ├── routes/           # API endpoints
│   ├── controllers/       # Request handlers
│   ├── services/         # Business logic
│   ├── middleware/       # Auth, validation, etc.
│   ├── models/           # Data models & schemas
│   ├── repositories/     # Database access
│   ├── types/            # Local type definitions
│   └── config/           # Configuration
├── prisma/
│   └── schema.prisma    # Database schema
├── tsconfig.json
├── package.json
└── dist/                # Build output
```

## 3. Database Layer (Tầng Cơ Sở Dữ Liệu)

### Công Nghệ
- **CSDL**: PostgreSQL 15+
- **ORM**: Prisma (từ backend)
- **Công Cụ Quản Lý**: Prisma Migrations

### Phạm Vi Dữ Liệu Chính
- **Users**: Người dùng ứng dụng
- **Parts**: Thư viện phụ tùng
- **Orders**: Đơn hàng bán
- **Inventory**: Tồn kho
- **SyncLog**: Nhật ký đồng bộ
- **ConflictResolution**: Lưu trữ giải quyết xung đột

### Đặc Điểm
- Toàn vẹn dữ liệu: Foreign keys & constraints
- Indexed queries: Hiệu suất truy vấn
- Backup & Recovery: Chiến lược sao lưu thường xuyên
- ACID Compliance: Tính nhất quán giao dịch

## 4. Shared Packages (@sparelink/shared)

### Mục Đích
Cung cấp loại, giao diện và tiện ích chung cho cả Desktop và API

### Nội Dung
- **Types**: Các loại chia sẻ (ResultType, SearchResultItem, ParsedCode, v.v.)
- **Parsing**: PartCodeParser để phân tích mã phụ tùng
- **Utilities**: Các hàm tiện ích chung
- **Constants**: Hằng số dùng chung
- **Validators**: Mô tả xác thực dùng chung

### Cấu Trúc
```
packages/shared/
├── src/
│   ├── types/           # Shared type definitions
│   ├── parsing/         # Part code parsing logic
│   ├── utils/           # Common utilities
│   ├── constants/       # Shared constants
│   └── index.ts         # Main export
├── tsconfig.json
├── package.json
└── dist/               # Build output
```

## Luồng Dữ Liệu - Offline-First

### Kịch Bản 1: Online - Tạo Đơn Hàng

```
Desktop App (React)
    ↓ (create order)
Zustand Store (state updated locally)
    ↓ (sync immediately - online)
React Query (HTTP POST to backend)
    ↓
Backend API (Fastify)
    ↓ (validate & persist)
PostgreSQL Database
    ↓ (success response)
Zustand Store (update with server ID)
    ↓
React UI (display with confirmation)
```

### Kịch Bản 2: Offline - Tạo Đơn Hàng

```
Desktop App (React)
    ↓ (create order)
Zustand Store (state updated locally)
    ↓ (detect offline)
SQLite Local Database (cache order locally)
    ↓
Sync Queue (add to pending queue)
    ↓
UI (show "pending sync" status)
    ↓ (when online)
React Query (HTTP POST queued items)
    ↓
Backend API (receive & validate)
    ↓
PostgreSQL Database (persist)
    ↓ (conflict detected?)
    ├─→ Yes: Conflict Resolution Logic
    │         (client-wins: keep local / server-wins: use server)
    └─→ No: Update local cache & mark synced
```

### Kịch Bản 3: Giải Quyết Xung Đột

```
Conflict Detected:
  - Desktop modified order locally
  - Server modified same order remotely

Resolution Strategy:
  1. Detect: Compare timestamps & versions
  2. Decide: Apply configured strategy (server-wins / client-wins / merge)
  3. Resolve: Update local cache with resolved version
  4. Sync: Send resolution to server for logging

Storage:
  - ConflictResolution table: Lưu trữ lịch sử
  - MachineContext: Ghi nhận which device made changes
```

## Bảo Mật

### Authentication (Xác Thực)
- **JWT Tokens**: Phát hành bởi backend sau khi đăng nhập
- **Token Refresh**: Làm mới mã token hết hạn
- **Secure Storage**: Lưu trữ token trong Electron's secure storage

### Authorization (Ủy Quyền)
- **Role-Based Access Control (RBAC)**: Admin, Manager, Staff
- **Permission Checks**: Kiểm tra quyền tại API
- **Data Isolation**: Người dùng chỉ nhìn thấy dữ liệu của họ

### Data Protection (Bảo Vệ Dữ Liệu)
- **HTTPS/TLS**: Mã hoá truyền tải
- **Password Hashing**: bcrypt hoặc Argon2
- **Input Validation**: Zod schemas
- **SQL Injection Prevention**: Prisma (parameterized queries)

## Triển Khai & DevOps

### Development
```bash
pnpm install          # Install all dependencies
pnpm dev              # Start all apps in dev mode
pnpm build            # Build all apps
```

### Production
- **Desktop**: Package as Electron app (.exe/.dmg/.AppImage)
- **API**: Deploy to cloud (AWS, GCP, Azure, etc.)
- **Database**: Managed PostgreSQL service
- **CI/CD**: GitHub Actions / GitLab CI

### Monitoring & Logging
- **Backend Logs**: Pino → centralized log service
- **Desktop Logs**: Local file + optional remote
- **Performance**: Monitoring via APM tools
- **Errors**: Error tracking (Sentry, Rollbar)

## Tối Ưu Hoá Hiệu Suất

### Desktop
- Lazy loading components
- Code splitting với Vite
- SQLite indexing cho rapid queries
- React Query caching strategy

### Backend
- Database indexing
- Query optimization
- Caching layer (Redis)
- API rate limiting

### Database
- Connection pooling
- Query execution plans
- Partitioning (if needed)
- Archival strategy

## Tương Lai - Công Nghệ Mở Rộng

- **Real-time Sync**: WebSockets instead of polling
- **Mobile App**: React Native version
- **Offline Analytics**: Client-side aggregation
- **Image Processing**: Local OCR improvements
- **Data Encryption**: End-to-end encryption option
