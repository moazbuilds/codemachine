import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { initSchema } from './schema.js';

let db: Database | null = null;

export function getDB(): Database {
  if (db) return db;

  const dbPath = '.codemachine/logs/registry.db';

  const dir = dirname(dbPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  db = new Database(dbPath);

  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');

  initSchema(db);

  return db;
}

export function closeDB(): void {
  if (db) {
    db.close();
    db = null;
  }
}
