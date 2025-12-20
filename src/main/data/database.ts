import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { app } from 'electron';
import { join } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { createLogger } from '../core/logger';
import { EXPORT_CONFIG } from '../config/constants';

const logger = createLogger('Database');

let db: SqlJsDatabase | null = null;
let dbPath: string = '';

/**
 * Initialize the SQLite database
 * Creates the database file if it doesn't exist and sets up tables
 */
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

/**
 * Get the database instance
 * Throws if database hasn't been initialized
 */
export function getDatabase(): SqlJsDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Persist the database to disk
 */
export function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);
}

/**
 * Close the database connection
 */
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
      summary TEXT,
      action_items TEXT DEFAULT '[]',
      participants TEXT DEFAULT '[]'
    )
  `);

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

/**
 * Helper to convert SQL result row to object
 */
export function resultToObject(result: { columns: string[]; values: unknown[][] }): Record<string, unknown> {
  if (result.values.length === 0) return {};
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < result.columns.length; i++) {
    obj[result.columns[i]] = result.values[0][i];
  }
  return obj;
}

/**
 * Helper to convert SQL result row at index to object
 */
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
