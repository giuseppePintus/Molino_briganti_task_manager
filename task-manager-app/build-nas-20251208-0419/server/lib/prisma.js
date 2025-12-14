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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaClientManager = exports.prisma = void 0;
const client_1 = require("@prisma/client");
// Singleton pattern con supporto per reset della connessione
class PrismaClientManager {
    static getInstance() {
        if (!this.instance) {
            this.instance = new client_1.PrismaClient();
        }
        return this.instance;
    }
    /**
     * Reset della connessione Prisma - necessario dopo restore database
     * Disconnette e ricrea l'istanza per vedere i nuovi dati
     */
    static resetConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('🔄 Resetting Prisma connection...');
            if (this.instance) {
                yield this.instance.$disconnect();
                this.instance = null;
            }
            // Ricrea l'istanza
            this.instance = new client_1.PrismaClient();
            // Forza la riconnessione
            yield this.instance.$connect();
            console.log('✅ Prisma connection reset complete');
        });
    }
    static disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.instance) {
                yield this.instance.$disconnect();
                this.instance = null;
            }
        });
    }
}
exports.PrismaClientManager = PrismaClientManager;
PrismaClientManager.instance = null;
// Export dell'istanza singleton
exports.prisma = PrismaClientManager.getInstance();
// Export default per retrocompatibilità
exports.default = exports.prisma;
