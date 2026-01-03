import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import { runMigrations } from './migrations'

let db: Database.Database | null = null

export function initDatabase(): Database.Database {
  const dbPath = path.join(app.getPath('userData'), 'train-schedule.db')
  
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  
  runMigrations(db)
  
  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

export function optimizeDatabase(): void {
  const database = getDatabase()
  
  database.pragma('optimize')
  
  database.exec('VACUUM')
  
  database.exec('ANALYZE')
}

export function getDatabaseStats(): {
  size: number
  tables: { name: string; rows: number }[]
} {
  const database = getDatabase()
  
  const tables = database.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
  `).all() as { name: string }[]
  
  const tableStats = tables.map(t => {
    const count = database.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get() as { count: number }
    return { name: t.name, rows: count.count }
  })
  
  return {
    size: 0,
    tables: tableStats
  }
}

