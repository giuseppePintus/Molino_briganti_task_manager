import sqlite3
import json

backup_file = r"c:\Users\manue\Molino_briganti_task_manager\docker_tasks_db.sql"

try:
    conn = sqlite3.connect(backup_file)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get ALL tasks
    cursor.execute("SELECT COUNT(*) FROM Task")
    task_count = cursor.fetchone()[0]
    print(f"🎯 TOTAL TASKS FOUND: {task_count}\n")
    
    if task_count > 0:
        cursor.execute("SELECT * FROM Task ORDER BY id DESC")
        tasks = cursor.fetchall()
        
        print("=" * 100)
        print("YOUR TASKS:")
        print("=" * 100)
        
        task_list = []
        for task in tasks:
            task_dict = dict(task)
            task_list.append(task_dict)
            
            status = "✓ COMPLETED" if task_dict.get('completed') else "⏳ PENDING"
            if task_dict.get('paused'):
                status = "⏸ PAUSED"
            
            print(f"\n#{task_dict['id']} | {status}")
            print(f"  Title: {task_dict['title']}")
            print(f"  Description: {task_dict.get('description', 'N/A')}")
            print(f"  Priority: {task_dict.get('priority', 'MEDIUM')}")
            print(f"  Estimated: {task_dict.get('estimatedMinutes', 0)} min")
            print(f"  Scheduled: {task_dict.get('scheduledAt', 'N/A')}")
            if task_dict.get('assignedOperatorId'):
                print(f"  Assigned to: User #{task_dict.get('assignedOperatorId')}")
        
        # Save to JSON
        with open(r'c:\Users\manue\Molino_briganti_task_manager\RECOVERED_TASKS.json', 'w', encoding='utf-8') as f:
            json.dump(task_list, f, indent=2, ensure_ascii=False)
        
        print(f"\n\n✓✓✓ {task_count} TASKS RECOVERED AND SAVED TO RECOVERED_TASKS.json ✓✓✓\n")
    else:
        print("No tasks found in this database")
    
    conn.close()
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
