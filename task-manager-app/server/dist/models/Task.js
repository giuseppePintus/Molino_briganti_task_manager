"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Task = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
exports.Task = prisma_1.default.task;
