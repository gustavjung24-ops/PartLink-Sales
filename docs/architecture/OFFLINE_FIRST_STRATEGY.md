# Chiến Lược Offline-First - SPARELINK

## Tổng Quan

SPARELINK được thiết kế với chiến lược **Offline-First** (ưu tiên ngoại tuyến), cho phép ứng dụng hoạt động bình thường ngay cả khi không có kết nối internet. Dữ liệu được đồng bộ hoá với máy chủ khi kết nối được khôi phục.

## Thành Phần Chính

### 1. SQLite Cache (Bộ Đệm SQLite)

**Mục Đích**: Lưu trữ dữ liệu cục bộ để truy cập nhanh

**Cơ Sở Dữ Liệu Cục Bộ**:
```sql
-- Cached data from server
CREATE TABLE cached_parts (
  id TEXT PRIMARY KEY,
  part_number TEXT NOT NULL,
  name TEXT NOT NULL,
  price DECIMAL,
  stock INTEGER,
  cached_at TIMESTAMP,
  server_version INTEGER
);

-- Local orders when offline
CREATE TABLE local_orders (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  items JSON,
  total DECIMAL,
  status TEXT,
  created_at TIMESTAMP,
  synced BOOLEAN DEFAULT FALSE,
  server_id TEXT
);

-- Sync metadata
CREATE TABLE sync_metadata (
  resource_type TEXT,
  last_sync TIMESTAMP,
  server_version INTEGER,
  local_version INTEGER,
  PRIMARY KEY (resource_type)
);
```

**Chiến Lược Cache**:
- **TTL (Time-To-Live)**: Dữ liệu cache hết hạn sau 24 giờ
- **Size Limit**: Tối đa 100MB dữ liệu cục bộ
- **Prioritization**: Dữ liệu dùng thường xuyên được giữ lâu nhất

### 2. Hàng Đợi Đồng Bộ (Sync Queue)

**Mục Đích**: Theo dõi và quản lý các hoạt động chờ đồng bộ

**Cấu Trúc Hàng Đợi**:
```typescript
interface SyncQueueItem {
  id: string;                                    // Unique ID
  action: "create" | "update" | "delete" | "search";
  resource: string;                              // Resource type
  data: unknown;                                  // Payload
  timestamp: string;                              // When queued
  status: "pending" | "syncing" | "completed" | "failed";
  retryCount: number;                             // Retry attempts
  error?: string;                                 // Error message if failed
}
```

**Quy Tắc Hàng Đợi**:

1. **FIFO (First-In-First-Out)**: Thứ tự xử lý theo thứ tự thêm vào
2. **Priority Queue**: Thao tác quan trọng được xử lý trước
   - P1: Login/Logout
   - P2: Create Order
   - P3: Update Inventory
   - P4: Search/Read operations

3. **Batching**: Nhóm các yêu cầu tương tự để tối ưu hoá

**Các Giai Đoạn**:
```
┌─────────────┐
│   PENDING   │  Initial state when offline action created
└──────┬──────┘
       │ (when online detected)
       ↓
┌─────────────┐
│   SYNCING   │  Sending to server
└──────┬──────┘
       │
       ├─→ Success → COMPLETED ✓
       │
       └─→ Failure → Check if retryable
            │
            ├─→ Yes → PENDING (retry after delay)
            └─→ No → FAILED (manual intervention)
```

**Retry Logic**:
- Exponential backoff: 1s, 2s, 4s, 8s, 16s...
- Max retries: 5 attempts
- Failure threshold: After 5 failures → mark as failed

### 3. Giải Quyết Xung Đột (Conflict Resolution)

**Tình Huống Xung Đột**:
```
Local Desktop                Server
  User edits order    ----→ (offline)
  Creates version v1        (no sync)
                            ↓
                     Another user edits
                       same order
                     Creates version v2
                            ↓
  Internet restored    ←---- (sync check)
  Conflict detected!
```

**Chiến Lược Giải Quyết**:

#### 1. Server-Wins (Mặc Định)
```
Local:  { price: 100, edited: 14:00 }
Server: { price: 150, edited: 15:00 }
Result: { price: 150, edited: 15:00 }   // Use server version
```
**Khi Sử Dụng**:
- Dữ liệu nhạy cảm (giá cả, số lượng tồn)
- Multi-user edit scenarios
- Server là single source of truth

#### 2. Client-Wins
```
Local:  { status: "completed", edited: 14:00 }
Server: { status: "pending", edited: 13:00 }
Result: { status: "completed", edited: 14:00 }   // Use local
```
**Khi Sử Dụng**:
- Dữ liệu người dùng cục bộ (draft, temporary)
- Offline work prioritization
- User intent preservation

#### 3. Merge Strategy
```
Local:  { notes: "Updated", items: [A, B] }
Server: { tags: ["important"], amount: 200 }
Result: { 
  notes: "Updated",        // from local
  tags: ["important"],     // from server
  items: [A, B],           // from local
  amount: 200              // from server
}  // Merge non-conflicting fields
```
**Khi Sử Dụng**:
- Của các trường khác nhau
- Dữ liệu bổ sung từ cả hai

#### 4. Manual Resolution (Thủ Công)
```
Conflict Dialog:
┌─────────────────────────────────┐
│ Data Conflict Detected          │
│───────────────────────────────── │
│ Field: price                    │
│ Local:  $100                    │
│ Server: $150                    │
│───────────────────────────────── │
│ [Use Local]  [Use Server] [Edit]│
└─────────────────────────────────┘
```

**Lưu Trữ Giải Quyết**:
```typescript
interface ConflictResolution {
  id: string;
  resource_type: string;     // "order", "part", etc.
  resource_id: string;
  strategy: "server-wins" | "client-wins" | "merge" | "manual";
  local_version: any;
  server_version: any;
  resolved_version: any;
  resolved_at: string;
  resolved_by: string;       // User ID or system
}
```

## Chi Tiết Triển Khai

### Phía Desktop

**Zustand Store**:
```typescript
// offlineStore.ts
const useOfflineStore = create((set, get) => ({
  isOnline: navigator.onLine,
  syncQueue: [],
  cachedData: {},
  
  // Phát hiện trạng thái kết nối
  setOnline: (online) => set({ isOnline: online }),
  
  // Thêm vào hàng đợi đồng bộ
  queueAction: (action) => set(state => ({
    syncQueue: [...state.syncQueue, action]
  })),
  
  // Xử lý hàng đợi
  processSyncQueue: async () => {
    // Gửi mỗi item theo thứ tự
  }
}));
```

**Cảm Biến Kết Nối**:
```typescript
useEffect(() => {
  window.addEventListener('online', () => {
    useOfflineStore.setState({ isOnline: true });
    // Trigger sync queue processing
  });
  
  window.addEventListener('offline', () => {
    useOfflineStore.setState({ isOnline: false });
    // Stop sync attempts
  });
}, []);
```

### Phía Backend

**Sync Endpoint**:
```typescript
// POST /api/sync/queue
router.post('/sync/queue', async (req, res) => {
  const items = req.body.items;  // Array of SyncQueueItem
  const results = [];
  
  for (const item of items) {
    try {
      // Validate & persist
      const result = await handleSyncItem(item);
      
      // Check for conflicts
      const conflict = await detectConflict(item);
      if (conflict) {
        result.resolution = await resolveConflict(conflict);
      }
      
      results.push({ id: item.id, success: true, ...result });
    } catch (error) {
      results.push({ id: item.id, success: false, error: error.message });
    }
  }
  
  res.json(results);
});
```

## Tối Ưu Hoá Hiệu Suất

### 1. Delta Sync (Đồng Bộ Chênh Lệch)
```
Initial Sync:  Download all 1000 records
Large payload: 5MB

Delta Sync:    Download only changes since last sync
               Only 10 updated records
Efficient:     100KB
```

**Cách Triển Khai**:
- Lưu trữ `last_sync_timestamp`
- Truy vấn: `SELECT * FROM parts WHERE updated_at > last_sync_time`
- Cập nhật: `last_sync_timestamp = now()`

### 2. Compression (Nén)
```
Uncompressed: 5MB
Gzip:         500KB (90% reduction)
```

### 3. Batch Processing (Xử Lý Theo Lô)
```
10 requests separately: 10 round trips
Batch 10 together:      1 round trip
```

## Xử Lý Lỗi & Phục Hồi

### Kịch Bản 1: Mất Kết Nối Giữa Đồng Bộ
```
Offline mid-sync:
  - Cancel request
  - Mark item as "pending"
  - Retry when online again
```

### Kịch Bản 2: Dữ Liệu Tợi Ngàn
```
Server rejects item:
  - Log error details
  - Show to user: "Order validation failed"
  - Option to edit and retry
```

### Kịch Bản 3: Database Corruption
```
Detect: Integrity check fails
Action: 
  - Backup current DB
  - Reset to last known good state
  - Notify user: "Syncing to recover..."
  - Fetch fresh data from server
```

## Monitoring & Debugging

### Metrics to Track:
- Total items queued
- Sync success rate
- Conflict occurrence rate
- Average sync time
- Failed sync items

### Debug Logs:
```logging
2026-03-22 10:15:30 [SYNC] Queue item created: order-12345
2026-03-22 10:15:45 [SYNC] Starting sync batch (5 items)
2026-03-22 10:16:00 [CONFLICT] Detected: part-789 (v2 vs v3)
2026-03-22 10:16:01 [CONFLICT] Applied strategy: server-wins
2026-03-22 10:16:02 [SYNC] Batch completed: 5/5 succeeded
```

## API Contract

### Sync Request
```json
POST /api/sync/queue
{
  "machineId": "device-uuid-123",
  "items": [
    {
      "id": "queue-001",
      "action": "create",
      "resource": "orders",
      "data": { ... },
      "timestamp": "2026-03-22T10:15:30Z"
    }
  ]
}
```

### Sync Response
```json
{
  "success": true,
  "timestamp": "2026-03-22T10:16:00Z",
  "results": [
    {
      "id": "queue-001",
      "success": true,
      "serverId": "order-456",
      "conflict": null
    }
  ],
  "conflicts": [
    {
      "itemId": "queue-002",
      "strategy": "server-wins",
      "resolution": { ... }
    }
  ]
}
```

## Best Practices

1. **Always Validate Locally**: Check constraints before queuing
2. **Timestamp Everything**: Use server time for consistency
3. **Log Comprehensively**: Help debugging issues
4. **Test Offline Scenarios**: Simulate network failures
5. **Document Conflicts**: Keep audit trail
6. **User Communication**: Inform about sync status
7. **Graceful Degradation**: App works without server
8. **Security**: Validate all synced data on server
