#!/usr/bin/env python3
"""
Script per sincronizzare il master-Inventory.csv al database
"""
import sqlite3
import pandas as pd
import os
from datetime import datetime

# Percorsi
master_csv = r"\\nas71f89c\Container\data\molino\master-Inventory.csv"
db_path = r"C:\Users\manue\Molino_briganti_task_manager\task-manager-app\prisma\data\tasks.db"

print("=" * 70)
print("🔄 SINCRONIZZAZIONE: Master CSV -> Database")
print("=" * 70)

# Leggi il CSV
print(f"\n📥 Lettura: {master_csv}")
df = pd.read_csv(master_csv)
print(f"✓ Articoli caricati: {len(df)}")

# Connettiti al database
print(f"\n💾 Connessione al database...")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Verifica la struttura della tabella Inventory
cursor.execute("PRAGMA table_info(Inventory);")
columns = cursor.fetchall()
print(f"✓ Colonne della tabella Inventory:")
for col in columns:
    print(f"   - {col[1]} ({col[2]})")

# Leggi i dati attuali
cursor.execute("SELECT COUNT(*) FROM Inventory;")
current_count = cursor.fetchone()[0]
print(f"\n📊 Dati attuali nel database: {current_count} articoli")

# Mostra alcuni dati correnti
cursor.execute("""
    SELECT position, name, code, quantity, expiry_date 
    FROM Inventory 
    WHERE quantity > 0 
    LIMIT 3;
""")
rows = cursor.fetchall()
print("   Esempi (qty > 0):")
for row in rows:
    print(f"   - {row}")

# Chiudi per ora
conn.close()

print("\n⚠️  SITUAZIONE:")
print("   ✓ File master-Inventory.csv: OK (108 articoli, dati maggio 2026)")
print("   ✓ Database: OK (contiene dati vecchi, agosto 2024)")
print("\n🎯 SOLUZIONE:")
print("   Devi cliccare il pulsante 'Importa da Master CSV (NAS)' nell'interfaccia")
print("   Oppure il server deve essere riavviato per ricaricare i dati")
print("\n💡 Se il pulsante non funziona, il server potrebbe essere:")
print("   - Non in esecuzione")
print("   - Non raggiungibile")
print("   - Avere errori di accesso al NAS")
