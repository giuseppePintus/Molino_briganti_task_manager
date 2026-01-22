#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import sys

file_path = r"C:\Users\manue\Molino_briganti_task_manager\task-manager-app\public\backup-management.html"

# Leggi il file
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Sostituzioni emoji corrotti -> emoji corretti
replacements = {
    'ð\x9f\x92¾': '💾',
    'ð\x9f\xa0 ': '🏠',
    'ð\x9f\x93Š': '📊',
    'ð\x9f\x93…': '📅',
    'â\x9e•': '➕',
    'ð\x9f\x94§': '🔧',
    'â\x84¹ï¸': 'ℹ️',
    'ð\x9f\x93‹': '📋',
    'ð\x9f\x94„': '🔄',
    'â\x9a ï¸': '⚠️',
    'â\x8fº': '⏰',
    'â\x8f¸ï¸': '⏸️',
    'ð\x9f\x93': '📍',
    'ð\x9f\x93': '📁',
    'â\x9c…': '✅',
    'â\x96¶ï¸': '▶️',
    'â\x8c': '❌',
    'â\xb3': '⏳',
}

# Applica tutte le sostituzioni
for old, new in replacements.items():
    content = content.replace(old, new)

# Salva il file
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"✅ Emoji corretti! {len(replacements)} sostituzioni applicate.")
