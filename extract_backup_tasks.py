#!/usr/bin/env python3
import sqlite3
import json

backup_path = r'c:\Users\manue\Molino_briganti_task_manager\task-manager-app\backups\db-backup-2026-01-04T16-35-51-750Z.sql'

try:
    conn = sqlite3.connect(backup_path)
    conn.row_factory = sqlite3.Row  # Get results as dictionaries
    cursor = conn.cursor()
    
    # List tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("=== TABELLE DISPONIBILI ===")
    for table in tables:
        print(f"  - {table[0]}")
    
    # Get Task schema
    print("\n=== SCHEMA TASK ===")
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='Task';")
    schema = cursor.fetchone()
    if schema:
        print(schema[0])
    
    # Extract all tasks
    print("\n=== TASK NEL BACKUP ===")
    cursor.execute("SELECT * FROM Task ORDER BY createdAt DESC;")
    tasks = cursor.fetchall()
    print(f"Totale: {len(tasks)} task\n")
    
    for idx, task in enumerate(tasks, 1):
        task_dict = dict(task)
        print(f"{idx}. {task_dict['title']}")
        print(f"   ID: {task_dict['id']}")
        print(f"   Status: {task_dict.get('status', 'N/A')}")
        print(f"   Created: {task_dict.get('createdAt', 'N/A')}")
        print(f"   Description: {task_dict.get('description', '')[:60] if task_dict.get('description') else 'N/A'}")
        print()
    
    # Export as JSON for import
    print("\n=== EXPORT JSON ===")
    json_tasks = [dict(task) for task in tasks]
    with open(r'c:\Users\manue\Molino_briganti_task_manager\extracted_tasks.json', 'w', encoding='utf-8') as f:
        json.dump(json_tasks, f, indent=2, ensure_ascii=False)
    print("✓ Exported to extracted_tasks.json")
    
    conn.close()
    
except Exception as e:
    print(f"❌ Errore: {e}")
    import traceback
    traceback.print_exc()
