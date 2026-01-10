import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

// Percorso database warehouse - sarà in backup
const DB_PATH = '/share/Container/data/molino/warehouse-inventory.db';

export class WarehouseService {
  private static db: sqlite3.Database;

  /**
   * Inizializza il database warehouse
   */
  static async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      WarehouseService.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          console.error('❌ Errore connessione warehouse DB:', err);
          reject(err);
        } else {
          console.log('✅ Warehouse DB connesso:', DB_PATH);
          WarehouseService.createTables()
            .then(resolve)
            .catch(reject);
        }
      });
    });
  }

  /**
   * Crea tabella warehouse se non esiste
   */
  static async createTables(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `
        CREATE TABLE IF NOT EXISTS warehouse_articles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          position TEXT UNIQUE NOT NULL,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          quantity INTEGER NOT NULL DEFAULT 0,
          unit_price REAL,
          category TEXT,
          notes TEXT,
          imported_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_code ON warehouse_articles(code);
        CREATE INDEX IF NOT EXISTS idx_position ON warehouse_articles(position);
      `;
      
      WarehouseService.db.exec(sql, (err) => {
        if (err) {
          console.error('❌ Errore creazione tabelle:', err);
          reject(err);
        } else {
          console.log('✅ Tabelle warehouse create');
          resolve();
        }
      });
    });
  }

  /**
   * Importa articoli dal PDF
   */
  static async importFromPdf(): Promise<{ count: number; filePath: string }> {
    try {
      const pdfPath = '/share/Container/Inventory.pdf';
      
      if (!fs.existsSync(pdfPath)) {
        throw new Error(`PDF non trovato: ${pdfPath}`);
      }

      console.log('📄 Estrazione PDF in corso...');

      // Esegui Python nel container per estrarre il PDF
      const pythonScript = `
import pdfplumber
import json

articles = []
with pdfplumber.open('${pdfPath}') as pdf:
    for page_num, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        if not tables:
            continue
        
        for table in tables:
            for row in table:
                if not row or len(row) < 3:
                    continue
                
                # Salta header row
                if any(header_keyword in str(row[0]).lower() for header_keyword in ['pos', 'posizione']):
                    continue
                
                pos = str(row[0]).strip() if row[0] else ''
                code = str(row[1]).strip() if row[1] else ''
                name = str(row[2]).strip() if row[2] else ''
                
                if pos and code and name:
                    articles.append({
                        'position': pos,
                        'code': code,
                        'name': name
                    })

print(json.dumps(articles))
`;

      let result: string;
      try {
        result = execSync(`/usr/bin/python3 -c "${pythonScript.replace(/"/g, '\\"').replace(/\$/g, '\\$')}"`, { 
          encoding: 'utf-8',
          timeout: 30000,
          maxBuffer: 10 * 1024 * 1024
        }).trim();
      } catch (e: any) {
        throw new Error(`Python error: ${e.message}`);
      }

      const articles = JSON.parse(result);
      console.log(`📦 Estratti ${articles.length} articoli dal PDF`);

      // Inserisci nel database
      await WarehouseService.clearAndInsertArticles(articles);

      return {
        count: articles.length,
        filePath: pdfPath
      };
    } catch (error: any) {
      console.error('❌ Errore importazione PDF:', error.message);
      throw error;
    }
  }

  /**
   * Pulisci e inserisci articoli
   */
  static async clearAndInsertArticles(articles: any[]): Promise<void> {
    return new Promise((resolve, reject) => {
      WarehouseService.db.serialize(() => {
        // Pulisci tabella
        WarehouseService.db.run('DELETE FROM warehouse_articles', (err) => {
          if (err) {
            console.error('❌ Errore pulizia tabella:', err);
            reject(err);
            return;
          }

          // Inserisci articoli
          const stmt = WarehouseService.db.prepare(`
            INSERT INTO warehouse_articles (position, code, name, quantity)
            VALUES (?, ?, ?, 0)
          `);

          let inserted = 0;
          articles.forEach((article: any) => {
            stmt.run([article.position, article.code, article.name], (err) => {
              if (err) {
                console.warn(`⚠️ Errore inserimento ${article.code}:`, err.message);
              } else {
                inserted++;
              }
            });
          });

          stmt.finalize((err) => {
            if (err) {
              reject(err);
            } else {
              console.log(`✅ ${inserted} articoli inseriti nel warehouse`);
              resolve();
            }
          });
        });
      });
    });
  }

  /**
   * Leggi tutti gli articoli
   */
  static async getAllArticles(): Promise<any[]> {
    return new Promise((resolve, reject) => {
      WarehouseService.db.all(
        'SELECT * FROM warehouse_articles ORDER BY position',
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Aggiorna quantità articolo
   */
  static async updateQuantity(code: string, quantity: number): Promise<void> {
    return new Promise((resolve, reject) => {
      WarehouseService.db.run(
        'UPDATE warehouse_articles SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE code = ?',
        [quantity, code],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  /**
   * Chiudi connessione database
   */
  static close(): void {
    if (WarehouseService.db) {
      WarehouseService.db.close((err) => {
        if (err) {
          console.error('❌ Errore chiusura warehouse DB:', err);
        } else {
          console.log('✅ Warehouse DB chiuso');
        }
      });
    }
  }
}
