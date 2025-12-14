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
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function clearAllData() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('🗑️ Eliminazione di tutti i task e ordini...');
            // Elimina tutti i task
            const deletedTasks = yield prisma.task.deleteMany({});
            console.log(`✅ Task eliminati: ${deletedTasks.count}`);
            // Elimina tutti gli ordini
            const deletedOrders = yield prisma.order.deleteMany({});
            console.log(`✅ Ordini eliminati: ${deletedOrders.count}`);
            console.log('✅ Operazione completata!');
        }
        catch (error) {
            console.error('❌ Errore:', error);
        }
        finally {
            yield prisma.$disconnect();
        }
    });
}
clearAllData();
