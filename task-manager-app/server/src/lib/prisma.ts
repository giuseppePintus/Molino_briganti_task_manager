import { PrismaClient } from '@prisma/client';

// Singleton pattern con supporto per reset della connessione
class PrismaClientManager {
  private static instance: PrismaClient | null = null;

  static getInstance(): PrismaClient {
    if (!this.instance) {
      this.instance = new PrismaClient();
    }
    return this.instance;
  }

  /**
   * Reset della connessione Prisma - necessario dopo restore database
   * Disconnette e ricrea l'istanza per vedere i nuovi dati
   */
  static async resetConnection(): Promise<void> {
    console.log('🔄 Resetting Prisma connection...');
    if (this.instance) {
      await this.instance.$disconnect();
      this.instance = null;
    }
    // Ricrea l'istanza
    this.instance = new PrismaClient();
    // Forza la riconnessione
    await this.instance.$connect();
    console.log('✅ Prisma connection reset complete');
  }

  static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.$disconnect();
      this.instance = null;
    }
  }
}

// Export dell'istanza singleton
export const prisma = PrismaClientManager.getInstance();

// Export del manager per operazioni avanzate (reset, disconnect)
export { PrismaClientManager };

// Export default per retrocompatibilità
export default prisma;
