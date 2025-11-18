import { PrismaClient } from '@prisma/client';
import BackupService from '../services/backupService';

/**
 * Configura middleware Prisma per attivare backup automatico
 * su ogni operazione di database (create, update, delete)
 */
export function setupBackupMiddleware(prisma: PrismaClient): void {
  prisma.$use(async (params, next) => {
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
      BackupService.backupDatabase().catch(err =>
        console.error(`Backup middleware error after ${params.action}:`, err)
      );
    }

    return result;
  });

  console.log('✅ Prisma backup middleware configured');
}

export default setupBackupMiddleware;
