import { createApplicationPrismaClient } from './createPrismaClient';
// Singleton pattern con supporto per reset della connessione
class PrismaClientManager {
  private static instance: ReturnType<typeof createApplicationPrismaClient> | null = null;

  static getInstance(): ReturnType<typeof createApplicationPrismaClient> {
    if (!this.instance) {
      this.instance = createApplicationPrismaClient();
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
    this.instance = createApplicationPrismaClient();
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
