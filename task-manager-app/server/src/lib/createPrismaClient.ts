import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../server/.env') });

export function createPrismaClient(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to initialize Prisma');
  }
  if (!connectionString.startsWith('mysql://')) {
    throw new Error('This Prisma client is configured for MySQL/MariaDB URLs only');
  }

  const adapter = new PrismaMariaDb(connectionString);
  return new PrismaClient({ adapter });
}

export function createApplicationPrismaClient() {
  const client = createPrismaClient();
  const writeOperations = new Set([
    'create',
    'update',
    'delete',
    'createMany',
    'updateMany',
    'deleteMany'
  ]);

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, args, query }) {
          const result = await query(args);
          if (writeOperations.has(operation)) {
            void import('../services/backupService')
              .then(({ default: backupService }) => backupService.backupDatabase())
              .catch(error => console.error(`Prisma backup error after ${operation}:`, error));
          }
          return result;
        }
      }
    }
  });
}