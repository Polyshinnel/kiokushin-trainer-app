# Этап 2: База данных

**Срок: 1-2 дня**

---

## Цель этапа

Настроить SQLite базу данных, создать все таблицы, написать миграции и CRUD-операции для всех сущностей.

---

## Шаги выполнения

### 2.1 Инициализация базы данных

**Файл `electron/database/index.ts`:**
```typescript
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
```

### 2.2 Создание миграций

**Файл `electron/database/migrations.ts`:**
```typescript
import Database from 'better-sqlite3'

const migrations = [
  {
    version: 1,
    name: 'initial_schema',
    up: `
      -- Таблица сотрудников
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        birth_year INTEGER,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT DEFAULT 'pending'
      );

      -- Таблица клиентов
      CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        birth_year INTEGER,
        phone TEXT,
        last_payment_date DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT DEFAULT 'pending'
      );

      -- Таблица родителей клиентов
      CREATE TABLE IF NOT EXISTS clients_parents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL,
        full_name TEXT NOT NULL,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT DEFAULT 'pending',
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
      );

      -- Таблица групп
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        start_date DATE,
        trainer_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT DEFAULT 'pending',
        FOREIGN KEY (trainer_id) REFERENCES employees(id)
      );

      -- Таблица расписания групп
      CREATE TABLE IF NOT EXISTS group_schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending',
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      );

      -- Таблица участников групп
      CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        client_id INTEGER NOT NULL,
        joined_at DATE DEFAULT CURRENT_DATE,
        sync_status TEXT DEFAULT 'pending',
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        UNIQUE(group_id, client_id)
      );

      -- Таблица занятий
      CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        lesson_date DATE NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT DEFAULT 'pending',
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      );

      -- Таблица посещаемости
      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lesson_id INTEGER NOT NULL,
        client_id INTEGER NOT NULL,
        status TEXT CHECK (status IN ('present', 'absent', 'sick') OR status IS NULL),
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        sync_status TEXT DEFAULT 'pending',
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
        UNIQUE(lesson_id, client_id)
      );

      -- Таблица логов синхронизации
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sync_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT,
        details TEXT
      );

      -- Таблица версий миграций
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Индексы
      CREATE INDEX IF NOT EXISTS idx_clients_full_name ON clients(full_name);
      CREATE INDEX IF NOT EXISTS idx_groups_trainer ON groups(trainer_id);
      CREATE INDEX IF NOT EXISTS idx_lessons_date ON lessons(lesson_date);
      CREATE INDEX IF NOT EXISTS idx_lessons_group ON lessons(group_id);
      CREATE INDEX IF NOT EXISTS idx_attendance_lesson ON attendance(lesson_id);
    `
  }
]

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  const appliedMigrations = db
    .prepare('SELECT version FROM migrations')
    .all() as { version: number }[]
  
  const appliedVersions = new Set(appliedMigrations.map(m => m.version))

  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`Applying migration ${migration.version}: ${migration.name}`)
      
      db.exec(migration.up)
      
      db.prepare('INSERT INTO migrations (version, name) VALUES (?, ?)')
        .run(migration.version, migration.name)
    }
  }
}
```

### 2.3 CRUD для сотрудников

**Файл `electron/database/queries/employees.ts`:**
```typescript
import { getDatabase } from '../index'

export interface Employee {
  id: number
  full_name: string
  birth_year: number | null
  phone: string | null
  created_at: string
  updated_at: string
  sync_status: string
}

export interface CreateEmployeeDto {
  full_name: string
  birth_year?: number
  phone?: string
}

export interface UpdateEmployeeDto {
  full_name?: string
  birth_year?: number
  phone?: string
}

export const employeeQueries = {
  getAll(): Employee[] {
    const db = getDatabase()
    return db.prepare('SELECT * FROM employees ORDER BY full_name').all() as Employee[]
  },

  getById(id: number): Employee | undefined {
    const db = getDatabase()
    return db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as Employee | undefined
  },

  create(data: CreateEmployeeDto): Employee {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO employees (full_name, birth_year, phone)
      VALUES (@full_name, @birth_year, @phone)
    `)
    const result = stmt.run({
      full_name: data.full_name,
      birth_year: data.birth_year ?? null,
      phone: data.phone ?? null
    })
    return this.getById(result.lastInsertRowid as number)!
  },

  update(id: number, data: UpdateEmployeeDto): Employee | undefined {
    const db = getDatabase()
    const fields: string[] = []
    const values: Record<string, unknown> = { id }

    if (data.full_name !== undefined) {
      fields.push('full_name = @full_name')
      values.full_name = data.full_name
    }
    if (data.birth_year !== undefined) {
      fields.push('birth_year = @birth_year')
      values.birth_year = data.birth_year
    }
    if (data.phone !== undefined) {
      fields.push('phone = @phone')
      values.phone = data.phone
    }

    if (fields.length === 0) return this.getById(id)

    fields.push("updated_at = CURRENT_TIMESTAMP")
    fields.push("sync_status = 'pending'")

    const stmt = db.prepare(`
      UPDATE employees SET ${fields.join(', ')} WHERE id = @id
    `)
    stmt.run(values)
    return this.getById(id)
  },

  delete(id: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM employees WHERE id = ?').run(id)
    return result.changes > 0
  }
}
```

### 2.4 CRUD для клиентов

**Файл `electron/database/queries/clients.ts`:**
```typescript
import { getDatabase } from '../index'

export interface Client {
  id: number
  full_name: string
  birth_year: number | null
  phone: string | null
  last_payment_date: string | null
  created_at: string
  updated_at: string
  sync_status: string
}

export interface ClientParent {
  id: number
  client_id: number
  full_name: string
  phone: string | null
}

export interface ClientWithParents extends Client {
  parents: ClientParent[]
}

export interface CreateClientDto {
  full_name: string
  birth_year?: number
  phone?: string
  last_payment_date?: string
  parents?: { full_name: string; phone?: string }[]
}

export interface UpdateClientDto {
  full_name?: string
  birth_year?: number
  phone?: string
  last_payment_date?: string
}

export const clientQueries = {
  getAll(): Client[] {
    const db = getDatabase()
    return db.prepare('SELECT * FROM clients ORDER BY full_name').all() as Client[]
  },

  getById(id: number): ClientWithParents | undefined {
    const db = getDatabase()
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as Client | undefined
    
    if (!client) return undefined
    
    const parents = db.prepare('SELECT * FROM clients_parents WHERE client_id = ?')
      .all(id) as ClientParent[]
    
    return { ...client, parents }
  },

  getDebtors(daysSincePayment: number = 30): Client[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT * FROM clients 
      WHERE last_payment_date IS NULL 
         OR date(last_payment_date) < date('now', '-' || ? || ' days')
      ORDER BY last_payment_date ASC
    `).all(daysSincePayment) as Client[]
  },

  search(query: string): Client[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT * FROM clients 
      WHERE full_name LIKE ? OR phone LIKE ?
      ORDER BY full_name
    `).all(`%${query}%`, `%${query}%`) as Client[]
  },

  create(data: CreateClientDto): ClientWithParents {
    const db = getDatabase()
    
    const createClient = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO clients (full_name, birth_year, phone, last_payment_date)
        VALUES (@full_name, @birth_year, @phone, @last_payment_date)
      `)
      const result = stmt.run({
        full_name: data.full_name,
        birth_year: data.birth_year ?? null,
        phone: data.phone ?? null,
        last_payment_date: data.last_payment_date ?? null
      })
      
      const clientId = result.lastInsertRowid as number
      
      if (data.parents && data.parents.length > 0) {
        const parentStmt = db.prepare(`
          INSERT INTO clients_parents (client_id, full_name, phone)
          VALUES (@client_id, @full_name, @phone)
        `)
        
        for (const parent of data.parents) {
          parentStmt.run({
            client_id: clientId,
            full_name: parent.full_name,
            phone: parent.phone ?? null
          })
        }
      }
      
      return clientId
    })
    
    const clientId = createClient()
    return this.getById(clientId)!
  },

  update(id: number, data: UpdateClientDto): ClientWithParents | undefined {
    const db = getDatabase()
    const fields: string[] = []
    const values: Record<string, unknown> = { id }

    if (data.full_name !== undefined) {
      fields.push('full_name = @full_name')
      values.full_name = data.full_name
    }
    if (data.birth_year !== undefined) {
      fields.push('birth_year = @birth_year')
      values.birth_year = data.birth_year
    }
    if (data.phone !== undefined) {
      fields.push('phone = @phone')
      values.phone = data.phone
    }
    if (data.last_payment_date !== undefined) {
      fields.push('last_payment_date = @last_payment_date')
      values.last_payment_date = data.last_payment_date
    }

    if (fields.length === 0) return this.getById(id)

    fields.push("updated_at = CURRENT_TIMESTAMP")
    fields.push("sync_status = 'pending'")

    db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = @id`).run(values)
    return this.getById(id)
  },

  updatePaymentDate(id: number, date: string): void {
    const db = getDatabase()
    db.prepare(`
      UPDATE clients 
      SET last_payment_date = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 'pending'
      WHERE id = ?
    `).run(date, id)
  },

  delete(id: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM clients WHERE id = ?').run(id)
    return result.changes > 0
  },

  addParent(clientId: number, data: { full_name: string; phone?: string }): ClientParent {
    const db = getDatabase()
    const result = db.prepare(`
      INSERT INTO clients_parents (client_id, full_name, phone)
      VALUES (@client_id, @full_name, @phone)
    `).run({
      client_id: clientId,
      full_name: data.full_name,
      phone: data.phone ?? null
    })
    
    return db.prepare('SELECT * FROM clients_parents WHERE id = ?')
      .get(result.lastInsertRowid) as ClientParent
  },

  removeParent(parentId: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM clients_parents WHERE id = ?').run(parentId)
    return result.changes > 0
  }
}
```

### 2.5 CRUD для групп

**Файл `electron/database/queries/groups.ts`:**
```typescript
import { getDatabase } from '../index'
import { Employee } from './employees'
import { Client } from './clients'

export interface Group {
  id: number
  name: string
  start_date: string | null
  trainer_id: number | null
  created_at: string
  updated_at: string
  sync_status: string
}

export interface GroupSchedule {
  id: number
  group_id: number
  day_of_week: number
  start_time: string
  end_time: string
}

export interface GroupMember {
  id: number
  group_id: number
  client_id: number
  joined_at: string
  client?: Client
}

export interface GroupWithDetails extends Group {
  trainer?: Employee
  schedule: GroupSchedule[]
  members: GroupMember[]
  member_count: number
}

export interface CreateGroupDto {
  name: string
  start_date?: string
  trainer_id?: number
  schedule?: { day_of_week: number; start_time: string; end_time: string }[]
}

export interface UpdateGroupDto {
  name?: string
  start_date?: string
  trainer_id?: number
}

export const groupQueries = {
  getAll(): (Group & { trainer_name: string | null; member_count: number })[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT 
        g.*,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
      FROM groups g
      LEFT JOIN employees e ON g.trainer_id = e.id
      ORDER BY g.name
    `).all() as (Group & { trainer_name: string | null; member_count: number })[]
  },

  getById(id: number): GroupWithDetails | undefined {
    const db = getDatabase()
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined
    
    if (!group) return undefined
    
    const trainer = group.trainer_id
      ? db.prepare('SELECT * FROM employees WHERE id = ?').get(group.trainer_id) as Employee
      : undefined
    
    const schedule = db.prepare('SELECT * FROM group_schedule WHERE group_id = ? ORDER BY day_of_week')
      .all(id) as GroupSchedule[]
    
    const members = db.prepare(`
      SELECT gm.*, c.full_name, c.phone, c.birth_year
      FROM group_members gm
      JOIN clients c ON gm.client_id = c.id
      WHERE gm.group_id = ?
      ORDER BY c.full_name
    `).all(id) as (GroupMember & { full_name: string; phone: string; birth_year: number })[]
    
    return {
      ...group,
      trainer,
      schedule,
      members: members.map(m => ({
        ...m,
        client: { 
          id: m.client_id, 
          full_name: m.full_name, 
          phone: m.phone,
          birth_year: m.birth_year
        } as Client
      })),
      member_count: members.length
    }
  },

  getByTrainer(trainerId: number): Group[] {
    const db = getDatabase()
    return db.prepare('SELECT * FROM groups WHERE trainer_id = ?').all(trainerId) as Group[]
  },

  create(data: CreateGroupDto): GroupWithDetails {
    const db = getDatabase()
    
    const createGroup = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO groups (name, start_date, trainer_id)
        VALUES (@name, @start_date, @trainer_id)
      `)
      const result = stmt.run({
        name: data.name,
        start_date: data.start_date ?? null,
        trainer_id: data.trainer_id ?? null
      })
      
      const groupId = result.lastInsertRowid as number
      
      if (data.schedule && data.schedule.length > 0) {
        const scheduleStmt = db.prepare(`
          INSERT INTO group_schedule (group_id, day_of_week, start_time, end_time)
          VALUES (@group_id, @day_of_week, @start_time, @end_time)
        `)
        
        for (const slot of data.schedule) {
          scheduleStmt.run({
            group_id: groupId,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time
          })
        }
      }
      
      return groupId
    })
    
    const groupId = createGroup()
    return this.getById(groupId)!
  },

  update(id: number, data: UpdateGroupDto): GroupWithDetails | undefined {
    const db = getDatabase()
    const fields: string[] = []
    const values: Record<string, unknown> = { id }

    if (data.name !== undefined) {
      fields.push('name = @name')
      values.name = data.name
    }
    if (data.start_date !== undefined) {
      fields.push('start_date = @start_date')
      values.start_date = data.start_date
    }
    if (data.trainer_id !== undefined) {
      fields.push('trainer_id = @trainer_id')
      values.trainer_id = data.trainer_id
    }

    if (fields.length === 0) return this.getById(id)

    fields.push("updated_at = CURRENT_TIMESTAMP")
    fields.push("sync_status = 'pending'")

    db.prepare(`UPDATE groups SET ${fields.join(', ')} WHERE id = @id`).run(values)
    return this.getById(id)
  },

  delete(id: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM groups WHERE id = ?').run(id)
    return result.changes > 0
  },

  addSchedule(groupId: number, data: { day_of_week: number; start_time: string; end_time: string }): GroupSchedule {
    const db = getDatabase()
    const result = db.prepare(`
      INSERT INTO group_schedule (group_id, day_of_week, start_time, end_time)
      VALUES (@group_id, @day_of_week, @start_time, @end_time)
    `).run({
      group_id: groupId,
      ...data
    })
    
    db.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(groupId)
    
    return db.prepare('SELECT * FROM group_schedule WHERE id = ?')
      .get(result.lastInsertRowid) as GroupSchedule
  },

  updateSchedule(scheduleId: number, data: { day_of_week?: number; start_time?: string; end_time?: string }): void {
    const db = getDatabase()
    const fields: string[] = []
    const values: Record<string, unknown> = { id: scheduleId }

    if (data.day_of_week !== undefined) {
      fields.push('day_of_week = @day_of_week')
      values.day_of_week = data.day_of_week
    }
    if (data.start_time !== undefined) {
      fields.push('start_time = @start_time')
      values.start_time = data.start_time
    }
    if (data.end_time !== undefined) {
      fields.push('end_time = @end_time')
      values.end_time = data.end_time
    }

    if (fields.length > 0) {
      fields.push("sync_status = 'pending'")
      db.prepare(`UPDATE group_schedule SET ${fields.join(', ')} WHERE id = @id`).run(values)
    }
  },

  removeSchedule(scheduleId: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM group_schedule WHERE id = ?').run(scheduleId)
    return result.changes > 0
  },

  addMember(groupId: number, clientId: number): GroupMember {
    const db = getDatabase()
    const result = db.prepare(`
      INSERT INTO group_members (group_id, client_id)
      VALUES (?, ?)
    `).run(groupId, clientId)
    
    db.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(groupId)
    
    return db.prepare('SELECT * FROM group_members WHERE id = ?')
      .get(result.lastInsertRowid) as GroupMember
  },

  removeMember(groupId: number, clientId: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM group_members WHERE group_id = ? AND client_id = ?')
      .run(groupId, clientId)
    
    if (result.changes > 0) {
      db.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(groupId)
    }
    
    return result.changes > 0
  },

  getScheduleForDay(dayOfWeek: number): (GroupSchedule & { group_name: string; trainer_name: string | null })[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT gs.*, g.name as group_name, e.full_name as trainer_name
      FROM group_schedule gs
      JOIN groups g ON gs.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      WHERE gs.day_of_week = ?
      ORDER BY gs.start_time
    `).all(dayOfWeek) as (GroupSchedule & { group_name: string; trainer_name: string | null })[]
  }
}
```

### 2.6 CRUD для занятий и посещаемости

**Файл `electron/database/queries/lessons.ts`:**
```typescript
import { getDatabase } from '../index'

export interface Lesson {
  id: number
  group_id: number
  lesson_date: string
  start_time: string
  end_time: string
  created_at: string
  sync_status: string
}

export interface LessonWithDetails extends Lesson {
  group_name: string
  trainer_name: string | null
  attendance_count: number
  total_members: number
}

export interface Attendance {
  id: number
  lesson_id: number
  client_id: number
  status: 'present' | 'absent' | 'sick' | null
  updated_at: string
}

export interface AttendanceWithClient extends Attendance {
  client_name: string
  client_phone: string | null
}

export const lessonQueries = {
  getAll(filters?: { groupId?: number; startDate?: string; endDate?: string }): LessonWithDetails[] {
    const db = getDatabase()
    let query = `
      SELECT 
        l.*,
        g.name as group_name,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM attendance WHERE lesson_id = l.id AND status IS NOT NULL) as attendance_count,
        (SELECT COUNT(*) FROM group_members WHERE group_id = l.group_id) as total_members
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      WHERE 1=1
    `
    
    const params: unknown[] = []
    
    if (filters?.groupId) {
      query += ' AND l.group_id = ?'
      params.push(filters.groupId)
    }
    if (filters?.startDate) {
      query += ' AND l.lesson_date >= ?'
      params.push(filters.startDate)
    }
    if (filters?.endDate) {
      query += ' AND l.lesson_date <= ?'
      params.push(filters.endDate)
    }
    
    query += ' ORDER BY l.lesson_date DESC, l.start_time ASC'
    
    return db.prepare(query).all(...params) as LessonWithDetails[]
  },

  getById(id: number): LessonWithDetails | undefined {
    const db = getDatabase()
    return db.prepare(`
      SELECT 
        l.*,
        g.name as group_name,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM attendance WHERE lesson_id = l.id AND status IS NOT NULL) as attendance_count,
        (SELECT COUNT(*) FROM group_members WHERE group_id = l.group_id) as total_members
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      WHERE l.id = ?
    `).get(id) as LessonWithDetails | undefined
  },

  getByDate(date: string): LessonWithDetails[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT 
        l.*,
        g.name as group_name,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM attendance WHERE lesson_id = l.id AND status = 'present') as attendance_count,
        (SELECT COUNT(*) FROM group_members WHERE group_id = l.group_id) as total_members
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      WHERE l.lesson_date = ?
      ORDER BY l.start_time ASC
    `).all(date) as LessonWithDetails[]
  },

  getTodayLessons(): LessonWithDetails[] {
    return this.getByDate(new Date().toISOString().split('T')[0])
  },

  create(data: { group_id: number; lesson_date: string; start_time: string; end_time: string }): Lesson {
    const db = getDatabase()
    
    const createLesson = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO lessons (group_id, lesson_date, start_time, end_time)
        VALUES (@group_id, @lesson_date, @start_time, @end_time)
      `).run(data)
      
      const lessonId = result.lastInsertRowid as number
      
      const members = db.prepare('SELECT client_id FROM group_members WHERE group_id = ?')
        .all(data.group_id) as { client_id: number }[]
      
      const attendanceStmt = db.prepare(`
        INSERT INTO attendance (lesson_id, client_id, status)
        VALUES (?, ?, NULL)
      `)
      
      for (const member of members) {
        attendanceStmt.run(lessonId, member.client_id)
      }
      
      return lessonId
    })
    
    const lessonId = createLesson()
    return db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId) as Lesson
  },

  generateFromSchedule(groupId: number, startDate: string, endDate: string): Lesson[] {
    const db = getDatabase()
    
    const schedule = db.prepare('SELECT * FROM group_schedule WHERE group_id = ?')
      .all(groupId) as { day_of_week: number; start_time: string; end_time: string }[]
    
    if (schedule.length === 0) return []
    
    const createdLessons: Lesson[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = (date.getDay() + 6) % 7 // Convert to Mon=0 format
      
      const daySchedule = schedule.find(s => s.day_of_week === dayOfWeek)
      if (daySchedule) {
        const lessonDate = date.toISOString().split('T')[0]
        
        const existing = db.prepare(`
          SELECT id FROM lessons WHERE group_id = ? AND lesson_date = ?
        `).get(groupId, lessonDate)
        
        if (!existing) {
          const lesson = this.create({
            group_id: groupId,
            lesson_date: lessonDate,
            start_time: daySchedule.start_time,
            end_time: daySchedule.end_time
          })
          createdLessons.push(lesson)
        }
      }
    }
    
    return createdLessons
  },

  delete(id: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM lessons WHERE id = ?').run(id)
    return result.changes > 0
  }
}

export const attendanceQueries = {
  getByLesson(lessonId: number): AttendanceWithClient[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT a.*, c.full_name as client_name, c.phone as client_phone
      FROM attendance a
      JOIN clients c ON a.client_id = c.id
      WHERE a.lesson_id = ?
      ORDER BY c.full_name
    `).all(lessonId) as AttendanceWithClient[]
  },

  updateStatus(lessonId: number, clientId: number, status: 'present' | 'absent' | 'sick' | null): Attendance {
    const db = getDatabase()
    
    db.prepare(`
      INSERT INTO attendance (lesson_id, client_id, status, updated_at, sync_status)
      VALUES (@lesson_id, @client_id, @status, CURRENT_TIMESTAMP, 'pending')
      ON CONFLICT(lesson_id, client_id) DO UPDATE SET
        status = @status,
        updated_at = CURRENT_TIMESTAMP,
        sync_status = 'pending'
    `).run({ lesson_id: lessonId, client_id: clientId, status })
    
    return db.prepare('SELECT * FROM attendance WHERE lesson_id = ? AND client_id = ?')
      .get(lessonId, clientId) as Attendance
  },

  getClientAttendance(clientId: number, startDate?: string, endDate?: string): (Attendance & { lesson_date: string; group_name: string })[] {
    const db = getDatabase()
    let query = `
      SELECT a.*, l.lesson_date, g.name as group_name
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN groups g ON l.group_id = g.id
      WHERE a.client_id = ?
    `
    
    const params: unknown[] = [clientId]
    
    if (startDate) {
      query += ' AND l.lesson_date >= ?'
      params.push(startDate)
    }
    if (endDate) {
      query += ' AND l.lesson_date <= ?'
      params.push(endDate)
    }
    
    query += ' ORDER BY l.lesson_date DESC'
    
    return db.prepare(query).all(...params) as (Attendance & { lesson_date: string; group_name: string })[]
  },

  getStatsByGroup(groupId: number): { present: number; absent: number; sick: number; total: number } {
    const db = getDatabase()
    const result = db.prepare(`
      SELECT 
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN a.status = 'sick' THEN 1 ELSE 0 END) as sick,
        COUNT(*) as total
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.group_id = ?
    `).get(groupId) as { present: number; absent: number; sick: number; total: number }
    
    return result
  }
}
```

### 2.7 IPC-мост между процессами

**Обновить `electron/main.ts`:**
```typescript
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { initDatabase, closeDatabase } from './database'
import { employeeQueries } from './database/queries/employees'
import { clientQueries } from './database/queries/clients'
import { groupQueries } from './database/queries/groups'
import { lessonQueries, attendanceQueries } from './database/queries/lessons'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

function setupIpcHandlers() {
  // Employees
  ipcMain.handle('db:employees:getAll', () => employeeQueries.getAll())
  ipcMain.handle('db:employees:getById', (_, id) => employeeQueries.getById(id))
  ipcMain.handle('db:employees:create', (_, data) => employeeQueries.create(data))
  ipcMain.handle('db:employees:update', (_, id, data) => employeeQueries.update(id, data))
  ipcMain.handle('db:employees:delete', (_, id) => employeeQueries.delete(id))

  // Clients
  ipcMain.handle('db:clients:getAll', () => clientQueries.getAll())
  ipcMain.handle('db:clients:getById', (_, id) => clientQueries.getById(id))
  ipcMain.handle('db:clients:search', (_, query) => clientQueries.search(query))
  ipcMain.handle('db:clients:getDebtors', (_, days) => clientQueries.getDebtors(days))
  ipcMain.handle('db:clients:create', (_, data) => clientQueries.create(data))
  ipcMain.handle('db:clients:update', (_, id, data) => clientQueries.update(id, data))
  ipcMain.handle('db:clients:updatePaymentDate', (_, id, date) => clientQueries.updatePaymentDate(id, date))
  ipcMain.handle('db:clients:delete', (_, id) => clientQueries.delete(id))
  ipcMain.handle('db:clients:addParent', (_, clientId, data) => clientQueries.addParent(clientId, data))
  ipcMain.handle('db:clients:removeParent', (_, parentId) => clientQueries.removeParent(parentId))

  // Groups
  ipcMain.handle('db:groups:getAll', () => groupQueries.getAll())
  ipcMain.handle('db:groups:getById', (_, id) => groupQueries.getById(id))
  ipcMain.handle('db:groups:create', (_, data) => groupQueries.create(data))
  ipcMain.handle('db:groups:update', (_, id, data) => groupQueries.update(id, data))
  ipcMain.handle('db:groups:delete', (_, id) => groupQueries.delete(id))
  ipcMain.handle('db:groups:addSchedule', (_, groupId, data) => groupQueries.addSchedule(groupId, data))
  ipcMain.handle('db:groups:updateSchedule', (_, scheduleId, data) => groupQueries.updateSchedule(scheduleId, data))
  ipcMain.handle('db:groups:removeSchedule', (_, scheduleId) => groupQueries.removeSchedule(scheduleId))
  ipcMain.handle('db:groups:addMember', (_, groupId, clientId) => groupQueries.addMember(groupId, clientId))
  ipcMain.handle('db:groups:removeMember', (_, groupId, clientId) => groupQueries.removeMember(groupId, clientId))
  ipcMain.handle('db:groups:getScheduleForDay', (_, day) => groupQueries.getScheduleForDay(day))

  // Lessons
  ipcMain.handle('db:lessons:getAll', (_, filters) => lessonQueries.getAll(filters))
  ipcMain.handle('db:lessons:getById', (_, id) => lessonQueries.getById(id))
  ipcMain.handle('db:lessons:getByDate', (_, date) => lessonQueries.getByDate(date))
  ipcMain.handle('db:lessons:getTodayLessons', () => lessonQueries.getTodayLessons())
  ipcMain.handle('db:lessons:create', (_, data) => lessonQueries.create(data))
  ipcMain.handle('db:lessons:generateFromSchedule', (_, groupId, startDate, endDate) => 
    lessonQueries.generateFromSchedule(groupId, startDate, endDate))
  ipcMain.handle('db:lessons:delete', (_, id) => lessonQueries.delete(id))

  // Attendance
  ipcMain.handle('db:attendance:getByLesson', (_, lessonId) => attendanceQueries.getByLesson(lessonId))
  ipcMain.handle('db:attendance:updateStatus', (_, lessonId, clientId, status) => 
    attendanceQueries.updateStatus(lessonId, clientId, status))
  ipcMain.handle('db:attendance:getClientAttendance', (_, clientId, startDate, endDate) => 
    attendanceQueries.getClientAttendance(clientId, startDate, endDate))
  ipcMain.handle('db:attendance:getStatsByGroup', (_, groupId) => attendanceQueries.getStatsByGroup(groupId))
}

app.whenReady().then(() => {
  initDatabase()
  setupIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
```

### 2.8 API-обёртки для renderer процесса

**Файл `src/lib/api.ts`:**
```typescript
// Employees API
export const employeesApi = {
  getAll: () => window.electronAPI.db.query('employees:getAll'),
  getById: (id: number) => window.electronAPI.db.query('employees:getById', id),
  create: (data: { full_name: string; birth_year?: number; phone?: string }) => 
    window.electronAPI.db.query('employees:create', data),
  update: (id: number, data: { full_name?: string; birth_year?: number; phone?: string }) =>
    window.electronAPI.db.query('employees:update', id, data),
  delete: (id: number) => window.electronAPI.db.query('employees:delete', id)
}

// Clients API
export const clientsApi = {
  getAll: () => window.electronAPI.db.query('clients:getAll'),
  getById: (id: number) => window.electronAPI.db.query('clients:getById', id),
  search: (query: string) => window.electronAPI.db.query('clients:search', query),
  getDebtors: (days?: number) => window.electronAPI.db.query('clients:getDebtors', days),
  create: (data: any) => window.electronAPI.db.query('clients:create', data),
  update: (id: number, data: any) => window.electronAPI.db.query('clients:update', id, data),
  updatePaymentDate: (id: number, date: string) => 
    window.electronAPI.db.query('clients:updatePaymentDate', id, date),
  delete: (id: number) => window.electronAPI.db.query('clients:delete', id),
  addParent: (clientId: number, data: { full_name: string; phone?: string }) =>
    window.electronAPI.db.query('clients:addParent', clientId, data),
  removeParent: (parentId: number) => window.electronAPI.db.query('clients:removeParent', parentId)
}

// Groups API
export const groupsApi = {
  getAll: () => window.electronAPI.db.query('groups:getAll'),
  getById: (id: number) => window.electronAPI.db.query('groups:getById', id),
  create: (data: any) => window.electronAPI.db.query('groups:create', data),
  update: (id: number, data: any) => window.electronAPI.db.query('groups:update', id, data),
  delete: (id: number) => window.electronAPI.db.query('groups:delete', id),
  addSchedule: (groupId: number, data: any) => 
    window.electronAPI.db.query('groups:addSchedule', groupId, data),
  updateSchedule: (scheduleId: number, data: any) =>
    window.electronAPI.db.query('groups:updateSchedule', scheduleId, data),
  removeSchedule: (scheduleId: number) => window.electronAPI.db.query('groups:removeSchedule', scheduleId),
  addMember: (groupId: number, clientId: number) =>
    window.electronAPI.db.query('groups:addMember', groupId, clientId),
  removeMember: (groupId: number, clientId: number) =>
    window.electronAPI.db.query('groups:removeMember', groupId, clientId),
  getScheduleForDay: (day: number) => window.electronAPI.db.query('groups:getScheduleForDay', day)
}

// Lessons API
export const lessonsApi = {
  getAll: (filters?: any) => window.electronAPI.db.query('lessons:getAll', filters),
  getById: (id: number) => window.electronAPI.db.query('lessons:getById', id),
  getByDate: (date: string) => window.electronAPI.db.query('lessons:getByDate', date),
  getTodayLessons: () => window.electronAPI.db.query('lessons:getTodayLessons'),
  create: (data: any) => window.electronAPI.db.query('lessons:create', data),
  generateFromSchedule: (groupId: number, startDate: string, endDate: string) =>
    window.electronAPI.db.query('lessons:generateFromSchedule', groupId, startDate, endDate),
  delete: (id: number) => window.electronAPI.db.query('lessons:delete', id)
}

// Attendance API
export const attendanceApi = {
  getByLesson: (lessonId: number) => window.electronAPI.db.query('attendance:getByLesson', lessonId),
  updateStatus: (lessonId: number, clientId: number, status: string | null) =>
    window.electronAPI.db.query('attendance:updateStatus', lessonId, clientId, status),
  getClientAttendance: (clientId: number, startDate?: string, endDate?: string) =>
    window.electronAPI.db.query('attendance:getClientAttendance', clientId, startDate, endDate),
  getStatsByGroup: (groupId: number) => window.electronAPI.db.query('attendance:getStatsByGroup', groupId)
}
```

---

## Проверка успешности этапа

- [ ] База данных создаётся в userData
- [ ] Все таблицы создаются корректно
- [ ] Миграции применяются один раз
- [ ] CRUD операции работают для всех сущностей
- [ ] IPC-вызовы работают между процессами
- [ ] Данные сохраняются после перезапуска

---

## Результат этапа

Полностью настроенная база данных с:
- Всеми необходимыми таблицами
- Системой миграций
- CRUD-операциями для всех сущностей
- IPC-мостом для связи renderer и main процессов
- API-обёртками для frontend

