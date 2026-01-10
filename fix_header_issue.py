#!/usr/bin/env python3
"""
Script per pulire il database e reimportare correttamente (senza header come articolo)
"""
import sqlite3
import pandas as pd

db_path = r"C:\Users\manue\Molino_briganti_task_manager\task-manager-app\prisma\data\tasks.db"
csv_path = r"\\nas71f89c\Container\data\molino\master-Inventory.csv"

print("=" * 70)
print("🧹 PULIZIA E REIMPORT - Rimozione articolo fantasma")
print("=" * 70)

# Connetti al database
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("\n📊 Stato PRIMA:")
cursor.execute("SELECT COUNT(*) FROM Inventory;")
before_count = cursor.fetchone()[0]
print(f"   Articoli nel database: {before_count}")

# Visualizza il primo articolo (il fantasma)
cursor.execute("""
    SELECT a.id, a.name, a.code 
    FROM Article a
    LIMIT 1;
""")
first = cursor.fetchone()
if first:
    print(f"   Primo articolo: ID={first[0]}, name='{first[1]}', code='{first[2]}'")

# Elimina tutti gli articoli e inventario
print("\n🧹 Eliminazione dati vecchi...")
cursor.execute("DELETE FROM Inventory;")
cursor.execute("DELETE FROM Article;")
conn.commit()

cursor.execute("SELECT COUNT(*) FROM Article;")
deleted_count = cursor.fetchone()[0]
print(f"   ✓ Articoli eliminati: {before_count - deleted_count}")

# Leggi il CSV (nuovo)
print(f"\n📥 Lettura CSV: {csv_path}")
df = pd.read_csv(csv_path)
print(f"   ✓ Righe nel CSV: {len(df)}")
print(f"   ✓ Colonne: {list(df.columns)}")

# Verifica che non abbia header come dati
print(f"\n🔍 Verifica integrità:")
print(f"   Prima riga Posizione: '{df.iloc[0]['Posizione']}'")
if df.iloc[0]['Posizione'] == 'Pos.':
    print("   ⚠️  ERRORE: Prima riga contiene header!")
    print("       Scartando prima riga...")
    df = df.iloc[1:].reset_index(drop=True)
else:
    print("   ✓ Prima riga è un articolo valido")

print(f"\n   Totale articoli da importare: {len(df)}")

# Mostra anteprima
print(f"\n   Anteprima:")
for idx, row in df.head(3).iterrows():
    print(f"   - {row['Posizione']}: {row['Nome']} ({row['Codice']}) x{row['Quantita']} - Scad: {row['Scadenza']}")

conn.close()

print("\n✅ OPERAZIONE DIAGNOSTICA COMPLETATA")
print("   Pronto per reimport corretto")
