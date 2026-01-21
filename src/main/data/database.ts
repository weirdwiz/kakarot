import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { createLogger } from '../core/logger';
import { EXPORT_CONFIG } from '../config/constants';

const logger = createLogger('Database');

let db: SqlJsDatabase | null = null;
let dbPath: string = '';

export async function initializeDatabase(): Promise<void> {
  const userDataPath = app.getPath('userData');
  const dataDir = join(userDataPath, EXPORT_CONFIG.DATA_DIR);

  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
    logger.info('Created data directory', { path: dataDir });
  }

  dbPath = join(dataDir, 'meetings.db');

  const SQL = await initSqlJs();

  if (existsSync(dbPath)) {
    const fileBuffer = readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    logger.info('Loaded existing database', { path: dbPath });
  } else {
    db = new SQL.Database();
    logger.info('Created new database', { path: dbPath });
  }

  createTables();
  saveDatabase();
}

export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

export function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);
}

export function closeDatabase(): void {
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    logger.info('Database closed');
  }
}

function createTables(): void {
  if (!db) throw new Error('Database not initialized');

  db.run(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      ended_at INTEGER,
      duration INTEGER DEFAULT 0,
      notes TEXT,
      notes_plain TEXT,
      notes_markdown TEXT,
      overview TEXT,
      summary TEXT,
      chapters TEXT DEFAULT '[]',
      people TEXT DEFAULT '[]',
      action_items TEXT DEFAULT '[]',
      participants TEXT DEFAULT '[]'
    )
  `);

  // Migration: add new columns if they don't exist
  const columns = db.exec("PRAGMA table_info(meetings)");
  const existingCols = columns.length > 0
    ? columns[0].values.map((row) => row[1] as string)
    : [];
  const newCols = [
    { name: 'notes', def: 'TEXT' },
    { name: 'notes_plain', def: 'TEXT' },
    { name: 'notes_markdown', def: 'TEXT' },
    { name: 'overview', def: 'TEXT' },
    { name: 'chapters', def: "TEXT DEFAULT '[]'" },
    { name: 'people', def: "TEXT DEFAULT '[]'" },
    { name: 'note_entries', def: "TEXT DEFAULT '[]'" },
    { name: 'attendee_emails', def: "TEXT DEFAULT '[]'" },
  ];
  for (const col of newCols) {
    if (!existingCols.includes(col.name)) {
      db.run(`ALTER TABLE meetings ADD COLUMN ${col.name} ${col.def}`);
      logger.info('Added column to meetings table', { column: col.name });
    }
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS transcript_segments (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      source TEXT NOT NULL,
      confidence REAL NOT NULL,
      is_final INTEGER NOT NULL,
      speaker_id TEXT,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS people (
      email TEXT PRIMARY KEY,
      name TEXT,
      last_meeting_at INTEGER NOT NULL,
      meeting_count INTEGER DEFAULT 1,
      total_duration INTEGER DEFAULT 0,
      notes TEXT,
      organization TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS callouts (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL,
      triggered_at INTEGER NOT NULL,
      question TEXT NOT NULL,
      context TEXT NOT NULL,
      suggested_response TEXT NOT NULL,
      sources TEXT DEFAULT '[]',
      dismissed INTEGER DEFAULT 0,
      FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.run(`CREATE INDEX IF NOT EXISTS idx_segments_meeting ON transcript_segments(meeting_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_callouts_meeting ON callouts(meeting_id)`);

  logger.debug('Database tables created/verified');
}

// Transaction management
let transactionDepth = 0;

export function beginTransaction(): void {
  const database = getDatabase();
  if (transactionDepth === 0) {
    database.run('BEGIN TRANSACTION');
    logger.debug('Transaction started');
  }
  transactionDepth++;
}

export function commitTransaction(): void {
  if (transactionDepth === 0) {
    logger.warn('Commit called without active transaction');
    return;
  }
  transactionDepth--;
  if (transactionDepth === 0) {
    const database = getDatabase();
    database.run('COMMIT');
    saveDatabase();
    logger.debug('Transaction committed');
  }
}

export function rollbackTransaction(): void {
  if (transactionDepth === 0) {
    logger.warn('Rollback called without active transaction');
    return;
  }
  transactionDepth = 0;
  const database = getDatabase();
  database.run('ROLLBACK');
  logger.debug('Transaction rolled back');
}

export async function withTransaction<T>(fn: () => T | Promise<T>): Promise<T> {
  beginTransaction();
  try {
    const result = await fn();
    commitTransaction();
    return result;
  } catch (error) {
    rollbackTransaction();
    throw error;
  }
}

export function resultToObject(result: { columns: string[]; values: unknown[][] }): Record<string, unknown> {
  if (result.values.length === 0) return {};
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < result.columns.length; i++) {
    obj[result.columns[i]] = result.values[0][i];
  }
  return obj;
}

export function resultToObjectByIndex(
  result: { columns: string[]; values: unknown[][] },
  rowIndex: number
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < result.columns.length; i++) {
    obj[result.columns[i]] = result.values[rowIndex][i];
  }
  return obj;
}
