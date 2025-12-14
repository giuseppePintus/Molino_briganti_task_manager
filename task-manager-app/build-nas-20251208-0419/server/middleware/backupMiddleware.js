"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupBackupMiddleware = setupBackupMiddleware;
const backupService_1 = __importDefault(require("../services/backupService"));
/**
 * Configura middleware Prisma per attivare backup automatico
 * su ogni operazione di database (create, update, delete)
 */
function setupBackupMiddleware(prisma) {
    // Verifica se $use è disponibile
    if (!prisma.$use || typeof prisma.$use !== 'function') {
        console.warn('⚠️ Prisma middleware ($use) not available in this version');
        console.info('ℹ️ Backup will only trigger on manual request and periodic schedule');
        return;
    }
    try {
        prisma.$use((params, next) => __awaiter(this, void 0, void 0, function* () {
            // Esegui query originale
            const result = yield next(params);
            // Se è un'operazione di modifica, attiva backup
            if (params.action === 'create' ||
                params.action === 'update' ||
                params.action === 'delete' ||
                params.action === 'createMany' ||
                params.action === 'updateMany' ||
                params.action === 'deleteMany') {
                // Backup asincrono in background (non blocca la response)
                backupService_1.default.backupDatabase().catch((err) => console.error(`Backup middleware error after ${params.action}:`, err));
            }
            return result;
        }));
        console.log('✅ Prisma backup middleware configured');
    }
    catch (error) {
        console.warn('⚠️ Failed to setup Prisma middleware:', error);
        console.info('ℹ️ Backup will only trigger on manual request and periodic schedule');
    }
}
exports.default = setupBackupMiddleware;
