import sqlite3
import json

backup_file = r"c:\Users\manue\Molino_briganti_task_manager\old_backup_vsc.sql"

try:
    conn = sqlite3.connect(backup_file)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM Task")
    task_count = cursor.fetchone()[0]
    print(f"Tasks in this backup: {task_count}\n")
    
    if task_count > 0:
        cursor.execute("SELECT * FROM Task ORDER BY id DESC LIMIT 20")
        tasks = cursor.fetchall()
        
        task_list = []
        for task in tasks:
            task_dict = dict(task)
            task_list.append(task_dict)
            print(f"✓ ID {task_dict['id']}: {task_dict['title']} (completed={task_dict.get('completed')})")
        
        # Save all tasks
        cursor.execute("SELECT * FROM Task ORDER BY id DESC")
        all_tasks = cursor.fetchall()
        
        with open(r'c:\Users\manue\Molino_briganti_task_manager\all_recovered_tasks.json', 'w', encoding='utf-8') as f:
            json.dump([dict(t) for t in all_tasks], f, indent=2, ensure_ascii=False)
        
        print(f"\n✓ {len(all_tasks)} tasks saved to all_recovered_tasks.json")
    
    conn.close()
except Exception as e:
    print(f"Error: {e}")
