#!/usr/bin/env python3
import sqlite3
import json

# Usa il backup più recente di oggi - ora è locale
backup_file = r"c:\Users\manue\Molino_briganti_task_manager\latest_backup_with_all_tasks.sql"

try:
    conn = sqlite3.connect(backup_file)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Get tasks
    cursor.execute("SELECT * FROM Task ORDER BY id DESC")
    tasks = cursor.fetchall()
    
    print(f"TOTAL TASKS FOUND: {len(tasks)}\n")
    print("=" * 100)
    
    task_list = []
    for task in tasks:
        task_dict = dict(task)
        task_list.append(task_dict)
        print(f"\n✓ ID: {task_dict['id']}")
        print(f"  Title: {task_dict['title']}")
        print(f"  Description: {task_dict.get('description', 'N/A')}")
        print(f"  Status: completed={task_dict.get('completed')}, paused={task_dict.get('paused')}")
        print(f"  Priority: {task_dict.get('priority', 'MEDIUM')}")
        print(f"  Created: {task_dict.get('createdAt')}")
        print(f"  Scheduled: {task_dict.get('scheduledAt')}")
        print(f"  Estimated: {task_dict.get('estimatedMinutes')} min")
    
    # Save to JSON for import
    with open(r'c:\Users\manue\Molino_briganti_task_manager\recovered_tasks.json', 'w', encoding='utf-8') as f:
        json.dump(task_list, f, indent=2, ensure_ascii=False)
    
    print(f"\n\n✓ Tasks saved to recovered_tasks.json")
    
    conn.close()
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
