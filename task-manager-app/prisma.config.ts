import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

config({ path: 'server/.env' });

export default defineConfig({
  schema: 'server/prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL')
  }
});