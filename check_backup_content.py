import sqlite3

backup_file = r"c:\Users\manue\Molino_briganti_task_manager\latest_backup_with_all_tasks.sql"

conn = sqlite3.connect(backup_file)
cursor = conn.cursor()

# Check all tables
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("Tables in this backup:")
for table in tables:
    cursor.execute(f"SELECT COUNT(*) FROM {table[0]}")
    count = cursor.fetchone()[0]
    print(f"  {table[0]:20} : {count}")

conn.close()
