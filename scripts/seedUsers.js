import { randomUUID } from 'node:crypto';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

import { env } from '../src/config/env.js';
import { hashPassword } from '../src/services/passwordService.js';

const USERNAMES = Object.freeze([
  'ramadhan',
  'bridawanyoga',
  'wisnukresno',
  'alifmahtum',
]);

const PASSWORD = process.env.SEED_USER_PASSWORD ?? '@Bandung1234';
const EMAIL_DOMAIN = process.env.SEED_USER_EMAIL_DOMAIN ?? 'gmail.com';

function toDisplayName(username) {
  return username
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toEmail(username) {
  return `${username.toLowerCase()}@${EMAIL_DOMAIN.toLowerCase()}`;
}

const adapter = new PrismaBetterSqlite3({ url: env.databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const seededUsers = [];

  for (const username of USERNAMES) {
    const email = toEmail(username);
    const passwordHash = await hashPassword(PASSWORD);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        password: passwordHash,
        displayName: toDisplayName(username),
      },
      create: {
        email,
        password: passwordHash,
        displayName: toDisplayName(username),
        publicId: randomUUID(),
      },
      select: {
        email: true,
        displayName: true,
        publicId: true,
      },
    });

    seededUsers.push(user);
  }

  console.log(`Seeded ${seededUsers.length} users.`);
  console.log(seededUsers);
}

try {
  await main();
} catch (error) {
  console.error('User seeder failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
