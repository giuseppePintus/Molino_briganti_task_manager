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

    // Create sample operators with images if they don't exist
    const operators = [
        { name: 'mario_rossi', emoji: '👨‍🔧' },
        { name: 'giovanni_bianchi', emoji: '👨‍💼' },
        { name: 'franco_neri', emoji: '👷' },
        { name: 'andrea_verdi', emoji: '🧑‍🏭' },
        { name: 'marco_giallo', emoji: '👨‍🌾' },
        { name: 'luca_azzurri', emoji: '🧑‍🔬' },
        { name: 'paolo_viola', emoji: '👨‍⚕️' },
        { name: 'antonio_rosa', emoji: '🧑‍💻' },
    ];
    
    for (const opData of operators) {
        const existing = await prisma.user.findUnique({
            where: { username: opData.name },
        });

        if (!existing) {
            const passwordHash = await bcryptjs.hash('operatorpass', 10);
            const op = await prisma.user.create({
                data: {
                    username: opData.name,
                    passwordHash,
                    role: 'slave',
                    image: opData.emoji, // Store emoji as image
                },
            });
            console.log('✅ Created operator:', op.username, opData.emoji);
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
