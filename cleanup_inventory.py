#!/usr/bin/env python3
"""
Standardizza il formato del CSV inventario
"""
import pandas as pd
import numpy as np

csv_path = r"C:\Users\manue\Molino_briganti_task_manager\task-manager-app\public\data\inventory_data.csv"

print("📊 Standardizzazione del CSV inventario...")

# Leggi il CSV
df = pd.read_csv(csv_path)

# Rinomina le colonne usando la prima riga (headers)
new_columns = ['Posizione', 'Nome', 'Codice', 'Lotto', 'Scadenza', 'Quantita', 'Annotazioni']

# Salta la prima riga se contiene headers
if df.iloc[0, 0] == 'Pos.':
    df = df.iloc[1:].reset_index(drop=True)

# Assegna i nomi delle colonne
df.columns = new_columns[:len(df.columns)]

# Pulisci i dati
df = df.fillna('')  # Sostituisci NaN con stringhe vuote
df['Quantita'] = pd.to_numeric(df['Quantita'], errors='coerce').fillna(0).astype(int)
df['Lotto'] = df['Lotto'].astype(str).str.strip()
df['Posizione'] = df['Posizione'].astype(str).str.strip()

# Rimuovi righe completamente vuote (solo posizione non vuota)
df = df[df['Posizione'].str.strip() != ''].reset_index(drop=True)

print(f"\n✓ Righe valide: {len(df)}")
print(f"✓ Colonne: {list(df.columns)}")

# Mostra anteprima
print("\n=== ANTEPRIMA DATI PULITI ===")
print(df.head(15).to_string())

# Salva il CSV pulito
df.to_csv(csv_path, index=False, encoding='utf-8')
print(f"\n✅ CSV standardizzato e salvato!")
print(f"   Inventario aggiornato: {len(df)} articoli")
