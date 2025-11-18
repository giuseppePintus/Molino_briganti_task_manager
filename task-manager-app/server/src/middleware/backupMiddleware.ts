import { PrismaClient } from '@prisma/client';
import BackupService from '../services/backupService';

/**
 * Configura middleware Prisma per attivare backup automatico
 * su ogni operazione di database (create, update, delete)
 */
export function setupBackupMiddleware(prisma: any): void {
  // Verifica se $use è disponibile
  if (!prisma.$use || typeof prisma.$use !== 'function') {
    console.warn('⚠️ Prisma middleware ($use) not available in this version');
    console.info('ℹ️ Backup will only trigger on manual request and periodic schedule');
    return;
  }

  try {
    prisma.$use(async (params: any, next: any) => {
      // Esegui query originale
      const result = await next(params);

      // Se è un'operazione di modifica, attiva backup
      if (
        params.action === 'create' ||
        params.action === 'update' ||
        params.action === 'delete' ||
        params.action === 'createMany' ||
        params.action === 'updateMany' ||
        params.action === 'deleteMany'
      ) {
        // Backup asincrono in background (non blocca la response)
        BackupService.backupDatabase().catch((err: any) =>
          console.error(`Backup middleware error after ${params.action}:`, err)
        );
      }

      return result;
    });

    console.log('✅ Prisma backup middleware configured');
  } catch (error) {
    console.warn('⚠️ Failed to setup Prisma middleware:', error);
    console.info('ℹ️ Backup will only trigger on manual request and periodic schedule');
  }
}

export default setupBackupMiddleware;
