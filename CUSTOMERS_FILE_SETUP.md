# Customers File Support - Setup Guide

## Overview
I clienti sono ora gestiti tramite un **file JSON statico** nel NAS, mantendo la compatibilità con le relazioni nel database.

- **File**: `/share/Container/data/molino/static/customers.json`
- **Container mount**: `/app/data` → Bind mount to NAS
- **API**: Rimane invariato (`/api/customers`)
- **CRUD**: POST, PUT, DELETE salvano automaticamente nel file JSON

## Architecture

```
┌─────────────────┐
│   Frontend      │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────────────────────────┐
│   Express API (/api/customers)      │
│  ├─ GET / - carica da file JSON     │
│  ├─ POST - aggiunge al file JSON    │
│  ├─ PUT - aggiorna file JSON        │
│  └─ DELETE - rimuove dal file JSON  │
└────────┬────────────────────────────┘
         │
    ┌────▼──────────────────┐
    │  CustomersFile Service │
    │ (server/src/services/ │
    │   customersFile.ts)   │
    └────┬──────────────────┘
         │ fs.readFileSync
         │ fs.writeFileSync
         ▼
┌─────────────────────────────┐
│  customers.json             │
│  (/app/data/customers.json) │
│  ↓ bind mount               │
│  (NAS:/share/Container/...) │
└─────────────────────────────┘
```

## Deployment Steps

### 1. Upload Files to NAS
```bash
cd /share/Container
tar -xzf task-manager-final-customers.tar.gz
```

### 2. Create Data Directory
```bash
mkdir -p /share/Container/data/molino/static
```

### 3. Copy Export Script to Container
```bash
docker cp export-customers-to-file.js molino-app:/app/
```

### 4. Export Customers from Database
```bash
docker exec molino-app node /app/export-customers-to-file.js
```

This will create `/app/data/customers.json` inside the container, which is bound to the NAS directory.

### 5. Verify
```bash
docker exec molino-app cat /app/data/customers.json | wc -l
```

### 6. Restart Container (to apply docker-compose changes)
```bash
docker restart molino-app
```

### 7. Test API
```bash
curl http://192.168.1.248:5000/api/customers | jq 'length'
```

## File Structure: customers.json

```json
[
  {
    "id": 1,
    "code": "CH001",
    "name": "Chiosco 1",
    "address": "vai cesenatico, 800",
    "city": "cesenatico",
    "province": null,
    "cap": null,
    "phone": "0123456789",
    "email": "chiosco@mail.it",
    "piva": null,
    "cf": null,
    "notes": null,
    "openingTime": "08:00",
    "closingTime": "16:00",
    "deliveryStartTime": "08:00",
    "deliveryEndTime": "16:00",
    "isActive": true,
    "createdAt": "2025-12-05T18:44:49.350Z",
    "updatedAt": "2025-12-09T09:33:41.242Z"
  },
  ...
]
```

## API Endpoints

All endpoints work the same as before, but now read/write from the JSON file:

- `GET /api/customers` - List all customers
- `GET /api/customers/:id` - Get single customer
- `POST /api/customers` - Create new customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer (soft or hard)
- `POST /api/customers/bulk` - Bulk import

## Benefits

1. **Persistence across deployments**: Customers survive container recreations
2. **Backup-friendly**: Easy to backup via NAS file system
3. **Edit-friendly**: Can edit customers.json directly in file manager
4. **Version control**: Can commit customers.json to git if needed
5. **No database migration**: Works alongside Prisma without conflicts

## Sync on Startup

The container's entrypoint includes a check: if `/app/data/customers.json` doesn't exist on container startup, it automatically exports from the database.

This is handled by `sync-customers-startup.sh`.

## Troubleshooting

### Customers not showing in API
```bash
# Check if file exists
docker exec molino-app ls -la /app/data/customers.json

# Check file size
docker exec molino-app wc -l /app/data/customers.json

# Check if file is valid JSON
docker exec molino-app node -e "console.log(require('/app/data/customers.json'))"
```

### Customers disappeared
The database still has the original customers (as backup). Re-export:
```bash
docker exec molino-app node /app/export-customers-to-file.js
```

### Need to restore from database
The customers are still in the SQLite database. To restore:
```bash
# Delete the JSON file
docker exec molino-app rm /app/data/customers.json

# Restart container (will auto-export on startup)
docker restart molino-app
```

## Files Changed

- `server/src/services/customersFile.ts` - New file management service
- `server/src/routes/customers.ts` - Modified to use CustomersFile service
- `docker-compose.yml` - Added bind mount `/app/data`
- `export-customers-to-file.js` - Script to export from DB to JSON

## Next: Backup Strategy

Consider adding a backup of `customers.json` to your backup routine:
```bash
# In your NAS backup script:
cp /share/Container/data/molino/static/customers.json \
   /share/Container/data/molino/backups/customers-$(date +%Y%m%d).json
```
