#!/usr/bin/env python3
"""
Script per importare i dati dal backup nel database corrente del NAS
"""
import json
import requests
from datetime import datetime

# Leggi i dati esportati
with open(r'c:\Users\manue\Molino_briganti_task_manager\backup_complete_export.json', 'r', encoding='utf-8') as f:
    backup_data = json.load(f)

# Configurazione NAS
NAS_URL = "http://192.168.1.248:5000"
HEADERS = {"Content-Type": "application/json"}

print("=== IMPORT DATI DAL BACKUP ===\n")
print(f"NAS URL: {NAS_URL}")
print(f"Timestamp: {datetime.now().isoformat()}\n")

import_stats = {
    'success': 0,
    'failed': 0,
    'skipped': 0,
    'errors': []
}

# 1. ARTICOLI
print("1️⃣ Importazione ARTICOLI...")
articles = backup_data.get('Article', [])
print(f"   Found {len(articles)} articles in backup")

for article in articles:
    try:
        # Prepara i dati per l'API
        payload = {
            'codiceArticolo': article.get('codiceArticolo'),
            'descrizioneBreveMaterial': article.get('descrizioneBreveMaterial'),
            'descrizioneArticolo': article.get('descrizioneArticolo'),
            'unitaMisura': article.get('unitaMisura', 'PZ'),
            'categoria': article.get('categoria'),
            'sottocategoria': article.get('sottocategoria'),
            'prezzo': article.get('prezzo'),
            'peso': article.get('peso'),
        }
        
        # POST al server
        response = requests.post(f"{NAS_URL}/api/articles", json=payload, headers=HEADERS, timeout=5)
        
        if response.status_code in [200, 201]:
            import_stats['success'] += 1
            print(f"   ✓ {article.get('codiceArticolo')} - {article.get('descrizioneArticolo')[:50]}")
        else:
            # Potrebbe già esistere - è ok
            if response.status_code == 409:  # Conflict
                import_stats['skipped'] += 1
            else:
                import_stats['failed'] += 1
                import_stats['errors'].append(f"Article {article.get('codiceArticolo')}: {response.status_code}")
                
    except Exception as e:
        import_stats['failed'] += 1
        import_stats['errors'].append(f"Article {article.get('codiceArticolo')}: {str(e)}")

# 2. INVENTORY
print(f"\n2️⃣ Importazione INVENTORY...")
inventories = backup_data.get('Inventory', [])
print(f"   Found {len(inventories)} inventory records in backup")

for inv in inventories:
    try:
        payload = {
            'articoloId': inv.get('articoloId'),
            'quantita': inv.get('quantita', 0),
            'scaffale': inv.get('scaffale'),
            'posizione': inv.get('posizione'),
        }
        
        response = requests.put(f"{NAS_URL}/api/articles/{inv.get('articoloId')}/inventory", json=payload, headers=HEADERS, timeout=5)
        
        if response.status_code in [200, 201]:
            import_stats['success'] += 1
        else:
            import_stats['failed'] += 1
            
    except Exception as e:
        import_stats['failed'] += 1

# 3. TASK
print(f"\n3️⃣ Importazione TASK...")
tasks = backup_data.get('Task', [])
print(f"   Found {len(tasks)} tasks in backup")

for task in tasks:
    try:
        payload = {
            'title': task.get('title'),
            'description': task.get('description'),
            'priority': task.get('priority', 'MEDIUM'),
            'color': task.get('color', '#FCD34D'),
            'estimatedMinutes': task.get('estimatedMinutes'),
        }
        
        response = requests.post(f"{NAS_URL}/api/tasks", json=payload, headers=HEADERS, timeout=5)
        
        if response.status_code in [200, 201]:
            import_stats['success'] += 1
            print(f"   ✓ {task.get('title')}")
        else:
            import_stats['failed'] += 1
            
    except Exception as e:
        import_stats['failed'] += 1

print(f"\n{'='*50}")
print(f"IMPORT RESULTS:")
print(f"  ✓ Success: {import_stats['success']}")
print(f"  ✗ Failed: {import_stats['failed']}")
print(f"  ⊘ Skipped: {import_stats['skipped']}")
print(f"{'='*50}")

if import_stats['errors']:
    print(f"\nErrors:")
    for error in import_stats['errors'][:5]:
        print(f"  - {error}")
