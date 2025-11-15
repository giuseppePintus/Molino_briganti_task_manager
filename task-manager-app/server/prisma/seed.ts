import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const prisma = new PrismaClient();

// Dati casuali per generare task
const taskTitles = [
    'Controllo qualità',
    'Manutenzione impianti',
    'Pulizia area lavoro',
    'Caricamento materiali',
    'Installazione nuovo equipment',
    'Riparazione macchinario',
    'Verifica sicurezza',
    'Ordine forniture',
    'Addestramento operatore',
    'Revisione strumenti',
    'Ispezione impianto',
    'Preparazione turno',
    'Smaltimento rifiuti',
    'Aggiornamento registro',
    'Controllo documenti'
];

const taskDescriptions = [
    'Completare il controllo giornaliero',
    'Verificare il funzionamento corretto',
    'Eseguire la manutenzione programmata',
    'Preparare i materiali necessari',
    'Verificare la conformità normativa',
    'Effettuare la pulizia generale',
    'Controllare gli strumenti di misurazione',
    'Documentare i risultati',
    'Comunicare problemi riscontrati',
    'Firmare il foglio di presenza'
];

const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function getRandomItem<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function generateRandomTasks(userId: number, count: number = 10) {
    const tasks = [];
    const today = new Date();
    
    for (let i = 0; i < count; i++) {
        // Genera una data casuale tra -30 giorni e +30 giorni da oggi
        const daysOffset = getRandomInt(-30, 30);
        const scheduledDate = new Date(today);
        scheduledDate.setDate(scheduledDate.getDate() + daysOffset);
        scheduledDate.setHours(getRandomInt(8, 18), getRandomInt(0, 59), 0, 0);
        
        tasks.push({
            title: getRandomItem(taskTitles).toUpperCase(),
            description: getRandomItem(taskDescriptions),
            scheduledAt: scheduledDate,
            priority: getRandomItem(priorities),
            estimatedMinutes: getRandomInt(15, 480),
            assignedOperatorId: userId,
            createdById: userId,
            recurring: false,
            recurrenceType: null,
            recurrenceEnd: null,
            completed: false,
            acceptedAt: null,
            paused: false,
        });
    }
    
    return tasks;
}

async function generateRecurringTask(userId: number) {
    const today = new Date();
    const recurrenceType = getRandomItem(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']);
    
    return {
        title: `RICORRENTE: ${getRandomItem(taskTitles).toUpperCase()}`,
        description: `Attività ricorrente ${recurrenceType.toLowerCase()} - ${getRandomItem(taskDescriptions)}`,
        scheduledAt: today,
        priority: getRandomItem(priorities),
        estimatedMinutes: getRandomInt(30, 240),
        assignedOperatorId: userId,
        createdById: userId,
        recurring: true,
        recurrenceType: recurrenceType,
        recurrenceEnd: new Date(today.getFullYear() + 1, today.getMonth(), today.getDate()),
        completed: false,
        acceptedAt: null,
        paused: false,
    };
}

async function main() {
    console.log('📝 Seeding database...\n');
    
    // Carica tutti gli utenti esistenti
    const allUsers = await prisma.user.findMany();
    
    if (allUsers.length === 0) {
        console.log('❌ Nessun utente trovato nel database!');
        return;
    }
    
    console.log(`✅ Trovati ${allUsers.length} utenti nel database`);
    allUsers.forEach(u => console.log(`   - ${u.username} (${u.role})`));
    
    // Genera task casuali per ogni utente esistente
    console.log('\n📝 Generazione task casuali...');
    for (const user of allUsers) {
        // Controlla se l'utente ha già task
        const existingTasksCount = await prisma.task.count({
            where: { assignedOperatorId: user.id }
        });
        
        if (existingTasksCount === 0) {
            // Genera 10 task casuali
            const randomTasks = await generateRandomTasks(user.id, 10);
            
            for (const taskData of randomTasks) {
                await prisma.task.create({
                    data: taskData,
                });
            }
            
            console.log(`  ✅ Aggiunti 10 task per ${user.username}`);
            
            // Genera 1 task ricorrente
            const recurringTask = await generateRecurringTask(user.id);
            await prisma.task.create({
                data: recurringTask,
            });
            
            console.log(`  ✅ Aggiunto 1 task ricorrente per ${user.username}`);
        } else {
            console.log(`  ⏭️ L'utente ${user.username} ha già ${existingTasksCount} task, salto generazione`);
        }
    }
    
    console.log('\n✅ Seeding completato!');
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
