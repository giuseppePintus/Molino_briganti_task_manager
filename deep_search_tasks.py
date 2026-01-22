import sqlite3
import json

backup_file = r"c:\Users\manue\Molino_briganti_task_manager\latest_backup_with_all_tasks.sql"

try:
    conn = sqlite3.connect(backup_file)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # First check ALL tables and their row counts
    print("=== INVENTORY CHECK ===\n")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = cursor.fetchall()
    
    for table_row in tables:
        table_name = table_row[0]
        try:
            cursor.execute(f'SELECT COUNT(*) FROM "{table_name}"')
            count = cursor.fetchone()[0]
            print(f"{table_name:20} : {count} records")
        except:
            print(f"{table_name:20} : ERROR")
    
    # Now try to get Task data with FULL debug
    print("\n=== TASK DETAILED CHECK ===\n")
    try:
        # Get the exact schema
        cursor.execute("PRAGMA table_info(Task)")
        columns = cursor.fetchall()
        print("Task table columns:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
        
        # Try simple SELECT *
        cursor.execute("SELECT * FROM Task LIMIT 5")
        rows = cursor.fetchall()
        print(f"\nFound {len(rows)} rows in Task table\n")
        
        for row in rows:
            print(dict(row))
        
        # Get total count
        cursor.execute("SELECT COUNT(*) FROM Task")
        total = cursor.fetchone()[0]
        print(f"\nTOTAL TASKS: {total}")
        
        if total > 0:
            # Export ALL tasks
            cursor.execute("SELECT * FROM Task ORDER BY id DESC")
            all_tasks = cursor.fetchall()
            
            task_list = [dict(t) for t in all_tasks]
            with open(r'c:\Users\manue\Molino_briganti_task_manager\FOUND_ALL_TASKS.json', 'w', encoding='utf-8') as f:
                json.dump(task_list, f, indent=2, ensure_ascii=False)
            
            print(f"\n✓✓✓ EXPORTED {total} TASKS TO FOUND_ALL_TASKS.json ✓✓✓")
    
    except Exception as e:
        print(f"Task error: {e}")
        import traceback
        traceback.print_exc()
    
    conn.close()
    
except Exception as e:
    print(f"Connection error: {e}")
    import traceback
    traceback.print_exc()
