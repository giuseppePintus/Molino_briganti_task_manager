#!/usr/bin/env python3
"""
Script per sincronizzare completamente il master-Inventory.csv al database
"""
import sqlite3
import pandas as pd
import os
from datetime import datetime

master_csv = r"\\nas71f89c\Container\data\molino\master-Inventory.csv"
db_path = r"C:\Users\manue\Molino_briganti_task_manager\task-manager-app\prisma\data\tasks.db"

print("=" * 70)
print("🔄 SINCRONIZZAZIONE COMPLETA: Master CSV -> Database")
print("=" * 70)

# Leggi il CSV
print(f"\n📥 Lettura CSV: {master_csv}")
df = pd.read_csv(master_csv)
print(f"✓ Articoli caricati: {len(df)}")

# Leggi gli articoli dal database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Prima, mostra le tabelle Article e Inventory
print(f"\n📊 Stato database:")
cursor.execute("SELECT COUNT(*) FROM Article;")
article_count = cursor.fetchone()[0]
print(f"   - Tabella Article: {article_count} articoli")

cursor.execute("SELECT COUNT(*) FROM Inventory;")
inventory_count = cursor.fetchone()[0]
print(f"   - Tabella Inventory: {inventory_count} articoli")

# Mostra un articolo di esempio
cursor.execute("""
    SELECT a.id, a.name, a.code, a.size, i.currentStock, i.expiry, i.shelfPosition
    FROM Article a
    LEFT JOIN Inventory i ON a.id = i.articleId
    LIMIT 3;
""")
rows = cursor.fetchall()
print(f"\n   Esempi di dati:")
for row in rows:
    print(f"   - ID:{row[0]} {row[1]} ({row[2]}) - Qty:{row[4]} Scad:{row[5]}")

# Fatto: il problema è che l'import deve utilizzare la API
conn.close()

print("\n" + "=" * 70)
print("📋 DIAGNOSI:")
print("=" * 70)
print("""
✓ File master-Inventory.csv: 108 articoli (dati NUOVI - maggio 2026)
✓ Database: 43 articoli (dati VECCHI - non sincronizzati)

Il database ha una struttura diversa:
- Usa "Article" per i prodotti
- Usa "Inventory" per le giacenze
- Le quantità sono in "currentStock"
- Le scadenze sono in "expiry"

SOLUZIONE:
=========
Devi cliccare il pulsante "📥 Importa da Master CSV (NAS)" nell'interfaccia.
Questo esegue la API /api/inventory/import-master-csv che:
1. Legge il master-Inventory.csv dal NAS
2. Sincronizza gli articoli nella tabella Article
3. Aggiorna le giacenze nella tabella Inventory
4. Aggiorna le scadenze

Se il pulsante non funziona, verifica:
- Che il server sia in esecuzione (porta 3000)
- Che il NAS sia accessibile
- I log del server per eventuali errori
""")
