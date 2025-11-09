"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Task = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
exports.Task = prisma.task;
