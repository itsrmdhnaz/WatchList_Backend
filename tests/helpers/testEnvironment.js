import { randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';

export async function createTestEnvironment() {
  const databaseName = `phase7-${randomUUID()}.sqlite`;
  const databasePath = resolve('database', databaseName);
  const previousDatabasePath = process.env.DATABASE_PATH;
  process.env.DATABASE_PATH = `./database/${databaseName}`;

  const migrationFolders = readdirSync('prisma/migrations', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const sqlite = new Database(databasePath);
  try {
    for (const folder of migrationFolders) {
      sqlite.exec(readFileSync(join('prisma/migrations', folder, 'migration.sql'), 'utf8'));
    }
  } finally {
    sqlite.close();
  }

  const [{ default: app }, { prisma }, { createAccessToken }, { env }] = await Promise.all([
    import('../../src/app.js'),
    import('../../src/core/database/prisma.js'),
    import('../../src/services/accessTokenService.js'),
    import('../../src/config/env.js'),
  ]);

  return {
    app,
    prisma,
    createAccessToken,
    corsOrigin: env.corsOrigin,
    mostWatchedMinimumRecords: env.mostWatchedMinRecords,
    async cleanup() {
      await prisma.$disconnect();
      for (const suffix of ['', '-wal', '-shm']) {
        rmSync(`${databasePath}${suffix}`, { force: true });
      }

      if (previousDatabasePath === undefined) {
        delete process.env.DATABASE_PATH;
      } else {
        process.env.DATABASE_PATH = previousDatabasePath;
      }
    },
  };
}
