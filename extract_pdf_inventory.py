#!/usr/bin/env python3
"""
Script per estrarre dati inventario dal PDF e aggiornare il CSV
"""
import pdfplumber
import pandas as pd
import os
import sys
from pathlib import Path

# Percorsi
pdf_path = r"\\nas71f89c\Container\Inventory.pdf"
csv_path = r"C:\Users\manue\Molino_briganti_task_manager\task-manager-app\public\data\inventory_data.csv"

print(f"📄 Estrazione dati dal PDF: {pdf_path}")
print(f"💾 Destinazione CSV: {csv_path}")
print("=" * 60)

# Estrai dati dal PDF
try:
    with pdfplumber.open(pdf_path) as pdf:
        print(f"✓ PDF aperto con successo. Pagine: {len(pdf.pages)}")
        
        all_tables = []
        
        # Estrai tabelle da ogni pagina
        for page_num, page in enumerate(pdf.pages, 1):
            print(f"\n📖 Pagina {page_num}:")
            tables = page.extract_tables()
            
            if tables:
                for table_idx, table in enumerate(tables):
                    print(f"   - Trovata tabella {table_idx + 1} con {len(table)} righe")
                    all_tables.extend(table)
            else:
                # Tenta estrazione testo
                text = page.extract_text()
                if text:
                    print(f"   - Testo estratto: {len(text.split(chr(10)))} linee")
        
        if not all_tables:
            print("\n⚠️  Nessuna tabella trovata nel PDF.")
            print("Tentando estrazione testo...")
            
            # Fallback: estrai tutto il testo
            all_text = ""
            for page in pdf.pages:
                all_text += page.extract_text() + "\n"
            
            print(f"Testo totale estratto: {len(all_text)} caratteri")
            print("\n=== ANTEPRIMA DEL CONTENUTO ===")
            print(all_text[:1000])
            print("...")
            sys.exit(1)
        
        # Converte le tabelle in DataFrame
        df = pd.DataFrame(all_tables)
        print(f"\n✓ Dati estratti: {len(df)} righe")
        print(f"\nColonne rilevate: {list(df.columns)}")
        print("\n=== ANTEPRIMA DEI DATI ===")
        print(df.head(10))
        
        # Standardizza i nomi colonna
        df.columns = [str(col).strip() for col in df.columns]
        
        # Salva in CSV
        df.to_csv(csv_path, index=False, encoding='utf-8')
        print(f"\n✅ Inventario aggiornato con successo!")
        print(f"   File salvato: {csv_path}")
        print(f"   Righe totali: {len(df)}")
        
except Exception as e:
    print(f"\n❌ Errore durante l'elaborazione:")
    print(f"   {type(e).__name__}: {str(e)}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
