#!/usr/bin/env python3
"""
Script per aggiornare completamente il master-inventory.csv dal PDF
Sostituisce completamente il vecchio contenuto senza mantenere nulla
"""
import pdfplumber
import pandas as pd
import os
from pathlib import Path

# Percorsi
pdf_path = r"\\nas71f89c\Container\Inventory.pdf"
master_csv_path = r"\\nas71f89c\Container\data\molino\master-Inventory.csv"

print("=" * 70)
print("🔄 TEST: Aggiornamento Master Inventory dal PDF")
print("=" * 70)
print(f"\n📄 Fonte: {pdf_path}")
print(f"💾 Destinazione: {master_csv_path}")

# Verifica accesso al percorso di destinazione
try:
    # Test lettura/scrittura
    test_path = Path(master_csv_path).parent
    if not test_path.exists():
        print(f"\n⚠️  Creazione directory: {test_path}")
        test_path.mkdir(parents=True, exist_ok=True)
except Exception as e:
    print(f"\n⚠️  Avviso percorso: {e}")

print("\n📥 Estrazione dati dal PDF...")

try:
    with pdfplumber.open(pdf_path) as pdf:
        print(f"✓ PDF aperto. Pagine: {len(pdf.pages)}")
        
        all_tables = []
        
        # Estrai tabelle da ogni pagina
        for page_num, page in enumerate(pdf.pages, 1):
            tables = page.extract_tables()
            if tables:
                for table in tables:
                    all_tables.extend(table)
                    print(f"  ✓ Pagina {page_num}: {len(table)} righe estratte")
        
        if not all_tables:
            print("❌ Errore: Nessuna tabella trovata nel PDF!")
            exit(1)
        
        # Crea DataFrame
        df = pd.DataFrame(all_tables)
        
        # Estrai headers dalla prima riga
        headers = [str(col).strip() for col in df.iloc[0]]
        df = df.iloc[1:].reset_index(drop=True)
        df.columns = headers
        
        # Standardizza i dati
        print("\n🔧 Standardizzazione dei dati...")
        
        df = df.fillna('')
        
        # Rinomina colonne per coerenza
        column_map = {
            'Pos.': 'Posizione',
            'Nome': 'Nome',
            'Codice': 'Codice',
            'Lotto': 'Lotto',
            'Scadenza': 'Scadenza',
            'Qt.': 'Quantita',
            'Annotazioni': 'Annotazioni'
        }
        
        df.columns = [column_map.get(col, col) for col in df.columns]
        
        # Converti quantità in numeri
        if 'Quantita' in df.columns:
            df['Quantita'] = pd.to_numeric(df['Quantita'], errors='coerce').fillna(0).astype(int)
        
        # Rimuovi righe completamente vuote
        df = df[df.iloc[:, 0].astype(str).str.strip() != ''].reset_index(drop=True)
        
        print(f"✓ Righe valide: {len(df)}")
        print(f"✓ Colonne: {list(df.columns)}")
        
        # Salva il file
        print(f"\n💾 Salvataggio in: {master_csv_path}")
        df.to_csv(master_csv_path, index=False, encoding='utf-8')
        
        print("\n" + "=" * 70)
        print("✅ TEST COMPLETATO CON SUCCESSO!")
        print("=" * 70)
        print(f"📊 Statistiche:")
        print(f"   - Articoli totali: {len(df)}")
        print(f"   - File: {master_csv_path}")
        print(f"   - Data aggiornamento: {pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        print(f"\n📋 Anteprima (prime 10 righe):")
        print(df.head(10).to_string())
        
except FileNotFoundError as e:
    print(f"\n❌ Errore: File non trovato")
    print(f"   {e}")
    exit(1)
except Exception as e:
    print(f"\n❌ Errore durante l'elaborazione:")
    print(f"   {type(e).__name__}: {str(e)}")
    import traceback
    traceback.print_exc()
    exit(1)
