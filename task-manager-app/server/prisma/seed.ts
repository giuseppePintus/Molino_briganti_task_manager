import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env' });

const prisma = new PrismaClient();

async function main() {
    // Check if master user already exists
    const masterUser = await prisma.user.findUnique({
        where: { username: 'master' },
    });

    if (!masterUser) {
        // Create default master user
        const defaultPassword = process.env.DEFAULT_MASTER_PASS || 'masterpass';
        const passwordHash = await bcryptjs.hash(defaultPassword, 10);

        const user = await prisma.user.create({
            data: {
                username: 'master',
                passwordHash,
                role: 'master',
            },
        });

        console.log('✅ Seeded master user:', user.username);
    } else {
        console.log('✅ Master user already exists:', masterUser.username);
    }

    // Create sample operators if they don't exist
    const operators = ['operatore1', 'operatore2', 'operatore3'];
    
    for (const opName of operators) {
        const existing = await prisma.user.findUnique({
            where: { username: opName },
        });

        if (!existing) {
            const passwordHash = await bcryptjs.hash('operatorpass', 10);
            const op = await prisma.user.create({
                data: {
                    username: opName,
                    passwordHash,
                    role: 'slave',
                },
            });
            console.log('✅ Created operator:', op.username);
        }
    }
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
