import { DatabaseSync } from 'node:sqlite';
import { mkdir, chmod } from 'node:fs/promises';
import { dirname } from 'node:path';
import { migrateSchema, importLegacyUsers, seedInitialCatalog } from './migrations.js';
export async function openDatabase(file, legacyPath) {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  try {
    if (process.platform !== 'win32') await chmod(file, 0o600);
    db.exec(
      'PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL;',
    );
    migrateSchema(db);
    await importLegacyUsers(db, legacyPath);
    seedInitialCatalog(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}
