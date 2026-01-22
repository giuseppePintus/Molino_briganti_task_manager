#!/usr/bin/env python3
import sqlite3
import json

backup_path = r'c:\Users\manue\Molino_briganti_task_manager\task-manager-app\backups\db-backup-2026-01-04T16-35-51-750Z.sql'
conn = sqlite3.connect(backup_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

print("=== STATISTICHE BACKUP ===\n")

# Count records
tables = ['Task', 'Article', 'Inventory', 'Order', 'Customer', 'User', 'TaskNote', 'StockMovement']
for table in tables:
    try:
        cursor.execute(f"SELECT COUNT(*) FROM {table};")
        count = cursor.fetchone()[0]
        print(f"{table:20} : {count:5} records")
    except:
        pass

# Export all tables as JSON
print("\n=== EXPORTING ALL DATA ===\n")

export_data = {}
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
tables = [row[0] for row in cursor.fetchall()]

for table in tables:
    try:
        cursor.execute(f'SELECT * FROM "{table}";')
        rows = cursor.fetchall()
        export_data[table] = [dict(row) for row in rows]
        print(f"✓ {table}: {len(rows)} records")
    except Exception as e:
        print(f"✗ {table}: {e}")

# Save to JSON
with open(r'c:\Users\manue\Molino_briganti_task_manager\backup_complete_export.json', 'w', encoding='utf-8') as f:
    json.dump(export_data, f, indent=2, ensure_ascii=False)

print("\n✓ Exported to backup_complete_export.json")

# Show summary
print(f"\nTotal records exported: {sum(len(v) for v in export_data.values())}")

conn.close()
