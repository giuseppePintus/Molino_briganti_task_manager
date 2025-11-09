import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

export const User = prisma.user;

export async function hashPassword(password: string): Promise<string> {
    return bcryptjs.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
    return bcryptjs.compare(password, hash);
}