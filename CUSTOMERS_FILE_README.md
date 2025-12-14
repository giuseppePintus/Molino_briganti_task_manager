✅ **CUSTOMERS FILE SUPPORT - IMPLEMENTED**

## What's Done

1. ✅ **New Service**: `server/src/services/customersFile.ts`
   - Loads/saves customers from JSON file
   - All CRUD operations (Create, Read, Update, Delete)
   - Search and filtering

2. ✅ **Updated API**: `server/src/routes/customers.ts`
   - Now uses `CustomersFile` service instead of Prisma
   - All endpoints work with JSON file storage
   - Backward compatible with frontend

3. ✅ **Docker Configuration**: `docker-compose.yml`
   - New bind mount: `/app/data` → `/share/Container/data/molino/static`
   - File location: `/app/data/customers.json`

4. ✅ **Export Script**: `export-customers-to-file.js`
   - Migrates customers from SQLite database to JSON file
   - Run on first deployment

5. ✅ **Build & Code**
   - TypeScript compilation successful (0 errors)
   - All files ready for deployment

## Files Modified

```
server/src/
  ├── services/
  │   └── customersFile.ts         (NEW - 250+ lines)
  └── routes/
      └── customers.ts             (MODIFIED - uses CustomersFile)

docker-compose.yml                 (MODIFIED - bind mount added)
export-customers-to-file.js        (NEW - migration script)
```

## What's Stored in JSON

Each customer object includes:
- id, code, name, address, city, province, cap
- phone, email, piva, cf, notes
- openingTime, closingTime, deliveryStartTime, deliveryEndTime
- isActive, createdAt, updatedAt

## Deployment Commands (Step by Step)

```bash
# 1. Extract uploaded tar
cd /share/Container
tar -xzf task-manager-final-customers.tar.gz

# 2. Create data directory
mkdir -p /share/Container/data/molino/static

# 3. Copy export script
docker cp export-customers-to-file.js molino-app:/app/

# 4. Ensure /app/data exists (docker exec molino-app mkdir -p /app/data)

# 5. Export from database to JSON file
docker exec molino-app node /app/export-customers-to-file.js

# 6. Verify
docker exec molino-app ls -lh /app/data/customers.json

# 7. Restart container to apply docker-compose changes
docker restart molino-app

# 8. Test API
curl http://192.168.1.248:5000/api/customers | jq 'length'
```

## How It Works

**On Read (GET /api/customers):**
1. API calls `CustomersFile.loadCustomers()`
2. Reads `/app/data/customers.json` 
3. Returns list to frontend

**On Write (POST/PUT/DELETE):**
1. API calls `CustomersFile.addCustomer()`, `updateCustomer()`, or `deleteCustomer()`
2. Reads current customers from file
3. Modifies the array
4. Writes back to `/app/data/customers.json`
5. Returns updated customer to frontend

**Persistence:**
- File is in bind mount → stored on NAS
- Survives container restart
- Easy to backup, edit, or version control

## Benefits

1. **Persistent storage**: Customers don't disappear when container restarts
2. **NAS-backed**: All data on network storage for safety
3. **Easy migration**: Can edit customers.json directly
4. **No database conflicts**: Works alongside Prisma
5. **Fast performance**: JSON file is in-memory efficient for small datasets

## Testing Commands

```bash
# List all customers
curl http://192.168.1.248:5000/api/customers | jq

# Count customers
curl http://192.168.1.248:5000/api/customers | jq 'length'

# Create new customer
curl -X POST http://192.168.1.248:5000/api/customers \
  -H "Content-Type: application/json" \
  -d '{"name":"New Bakery","city":"Roma","phone":"0612345678"}'

# Update customer
curl -X PUT http://192.168.1.248:5000/api/customers/1 \
  -H "Content-Type: application/json" \
  -d '{"phone":"0699999999"}'

# Check JSON file directly
docker exec molino-app cat /app/data/customers.json | jq
```

## Status: READY FOR DEPLOYMENT

All code is compiled and uploaded. Just need to:
1. Extract tar in NAS
2. Run export script
3. Restart container
4. Verify with test API call

See CUSTOMERS_FILE_SETUP.md for detailed setup guide.
