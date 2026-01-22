import sqlite3
import json

db_file = r"c:\Users\manue\Molino_briganti_task_manager\FINAL_TASKS_TODAY.db"

try:
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM Task")
    count = cursor.fetchone()[0]
    
    print(f"\n{'='*100}")
    print(f"✓✓✓ FOUND {count} TASKS! ✓✓✓")
    print(f"{'='*100}\n")
    
    if count > 0:
        cursor.execute("SELECT * FROM Task ORDER BY id")
        tasks = cursor.fetchall()
        
        task_list = []
        for task in tasks:
            task_dict = dict(task)
            task_list.append(task_dict)
            
            status = "✓ DONE" if task_dict.get('completed') else "⏳ PENDING"
            if task_dict.get('paused'):
                status = "⏸ PAUSED"
            
            print(f"  ID {task_dict['id']:2} | {status:10} | {task_dict['title']}")
        
        # Save to JSON
        with open(r'c:\Users\manue\Molino_briganti_task_manager\RECOVERED_ALL_TASKS.json', 'w', encoding='utf-8') as f:
            json.dump(task_list, f, indent=2, ensure_ascii=False)
        
        print(f"\n✓✓✓ All {count} tasks saved to RECOVERED_ALL_TASKS.json ✓✓✓\n")
    
    conn.close()
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
