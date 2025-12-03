#!/usr/bin/env python3
import os
import sys
import paramiko
from pathlib import Path

NAS_IP = "192.168.1.248"
NAS_USER = "vsc"
NAS_PASS = "vsc12345"
NAS_PATH = "/home/vsc/molino-app"
BUILD_FILE = "build-nas-20251130-2312.zip"

def upload_to_nas():
    print("[INFO] Connessione a NAS...")
    print(f"IP: {NAS_IP}, User: {NAS_USER}")
    
    if not os.path.exists(BUILD_FILE):
        print(f"[ERROR] File non trovato: {BUILD_FILE}")
        return False
    
    file_size = os.path.getsize(BUILD_FILE) / (1024*1024)
    print(f"[OK] File: {BUILD_FILE} ({file_size:.2f} MB)")
    
    try:
        # Connessione SSH
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(NAS_IP, username=NAS_USER, password=NAS_PASS, timeout=10)
        print("[OK] SSH connesso")
        
        # SFTP
        sftp = ssh.open_sftp()
        print(f"[INFO] Creazione directory {NAS_PATH}...")
        try:
            sftp.mkdir(NAS_PATH)
        except:
            pass  # Gia esiste
        
        print(f"[INFO] Upload del file...")
        sftp.put(BUILD_FILE, f"{NAS_PATH}/{BUILD_FILE}")
        print(f"[OK] File caricato!")
        
        # Verifica
        sftp.listdir(NAS_PATH)
        print("[OK] Verifica completata")
        
        sftp.close()
        ssh.close()
        
        print("\n[INFO] Prossimi step sul NAS:")
        print(f"cd {NAS_PATH}")
        print(f"unzip {BUILD_FILE}")
        print("cd build-nas-20251130-2312")
        print("npm install")
        print("npm start")
        
        return True
        
    except Exception as e:
        print(f"[ERROR] {e}")
        return False

if __name__ == "__main__":
    if upload_to_nas():
        print("\n[SUCCESS] Deploy completato!")
        sys.exit(0)
    else:
        print("\n[FAIL] Deploy fallito")
        sys.exit(1)
