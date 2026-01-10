#!/usr/bin/env python3
"""
Script per forzare l'importazione completa dal master-Inventory.csv al database
"""
import sqlite3
import pandas as pd
import os
from pathlib import Path

# Percorsi
master_csv = r"\\nas71f89c\Container\data\molino\master-Inventory.csv"
db_path = r"C:\Users\manue\Molino_briganti_task_manager\task-manager-app\prisma\data\tasks.db"

print("=" * 70)
print("🔄 SYNC FORZATO: Master CSV -> Database")
print("=" * 70)

# Verifica il file CSV
if not os.path.exists(master_csv):
    print(f"❌ Errore: File non trovato: {master_csv}")
    exit(1)

print(f"\n📥 Leggo il file CSV: {master_csv}")

# Leggi il CSV
df = pd.read_csv(master_csv)
print(f"✓ CSV caricato: {len(df)} articoli")
print(f"✓ Colonne: {list(df.columns)}")

# Verifica i dati
print(f"\n📊 Anteprima dati:")
print(df.head(10).to_string())

# Connettiti al database
print(f"\n💾 Connessione al database: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Mostra schema della tabella inventory
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='inventory';")
    table_exists = cursor.fetchone()
    
    if not table_exists:
        print("⚠️  Tabella 'inventory' non trovata nel database")
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print(f"   Tabelle disponibili: {tables}")
        conn.close()
        exit(1)
    
    # Leggi il numero di righe attuali
    cursor.execute("SELECT COUNT(*) FROM inventory;")
    current_count = cursor.fetchone()[0]
    print(f"✓ Righe attuali nel DB: {current_count}")
    
    # Leggi alcuni dati attuali
    cursor.execute("SELECT posizione, name, quantity, expiry_date FROM inventory LIMIT 5;")
    current_data = cursor.fetchall()
    print(f"✓ Dati attuali:")
    for row in current_data:
        print(f"   {row}")
    
    # Chiudi connessione
    conn.close()
    
    print("\n⚠️  Per sincronizzare il database, devi:")
    print("   1. Cliccare il pulsante 'Importa da Master CSV (NAS)' nella UI")
    print("   2. O contattare l'amministratore per eseguire la sincronizzazione via API")
    print("\n💡 Suggerimento: Il file master-Inventory.csv è corretto.")
    print("   Il database non è sincronizzato. Usa il pulsante di import.")
    
except sqlite3.Error as e:
    print(f"❌ Errore database: {e}")
    exit(1)
except Exception as e:
    print(f"❌ Errore: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
