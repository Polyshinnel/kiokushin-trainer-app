import Database from 'better-sqlite3'
import { createHash } from 'crypto'

type Migration = {
  version: number
  name: string
  up: string | ((db: Database.Database) => void)
}

const migrations: Migration[] = [
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
        birth_date DATE,
        phone TEXT,
        last_payment_date DATE,
        doc_type TEXT CHECK (doc_type IN ('passport', 'certificate') OR doc_type IS NULL),
        doc_series TEXT,
        doc_number TEXT,
        doc_issued_by TEXT,
        doc_issued_date DATE,
        home_address TEXT,
        workplace TEXT,
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
  },
  {
    version: 2,
    name: 'add_employee_login_password',
    up: (db: Database.Database) => {
      db.exec(`
        ALTER TABLE employees ADD COLUMN login TEXT;
        ALTER TABLE employees ADD COLUMN password TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_login ON employees(login) WHERE login IS NOT NULL;
      `)

      const passwordHash = createHash('sha256').update('kiokushinkai_123').digest('hex')
      
      const existingUser = db.prepare('SELECT id FROM employees WHERE login = ?').get('mishustin_r') as { id: number } | undefined
      if (!existingUser) {
        db.prepare(`
          INSERT INTO employees (full_name, login, password)
          VALUES (?, ?, ?)
        `).run('Мишустин Р.', 'mishustin_r', passwordHash)
        console.log('Created default user: mishustin_r')
      } else {
        db.prepare(`
          UPDATE employees SET password = ? WHERE login = ?
        `).run(passwordHash, 'mishustin_r')
        console.log('Updated password for user: mishustin_r')
      }
    }
  },
  {
    version: 3,
    name: 'add_subscriptions',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          price REAL NOT NULL,
          duration_days INTEGER NOT NULL,
          visit_limit INTEGER DEFAULT 0,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          sync_status TEXT DEFAULT 'pending'
        );

        CREATE TABLE IF NOT EXISTS client_subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          client_id INTEGER NOT NULL,
          subscription_id INTEGER NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          visits_used INTEGER DEFAULT 0,
          visits_total INTEGER DEFAULT 0,
          is_paid INTEGER DEFAULT 0,
          payment_date DATE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          sync_status TEXT DEFAULT 'pending',
          FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
          FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT
        );

        CREATE INDEX IF NOT EXISTS idx_client_subscriptions_client ON client_subscriptions(client_id);
        CREATE INDEX IF NOT EXISTS idx_client_subscriptions_dates ON client_subscriptions(start_date, end_date);
      `)

      const result = db.prepare(`
        INSERT INTO subscriptions (name, price, duration_days, visit_limit)
        VALUES ('Все включено', 3500, 30, 0)
      `).run()

      const subscriptionId = result.lastInsertRowid

      const today = new Date().toISOString().split('T')[0]
      const endDate = new Date()
      endDate.setDate(endDate.getDate() + 30)
      const endDateStr = endDate.toISOString().split('T')[0]

      db.prepare(`
        INSERT INTO client_subscriptions (client_id, subscription_id, start_date, end_date, visits_total, is_paid)
        SELECT id, ?, ?, ?, 0, 1
        FROM clients
      `).run(subscriptionId, today, endDateStr)

      console.log('Migration 3: Added subscriptions and assigned to all clients')
    }
  }
  ,{
    version: 4,
    name: 'add_client_documents_and_birth_date',
    up: (db: Database.Database) => {
      const columns = db.prepare(`PRAGMA table_info(clients)`).all() as { name: string }[]
      const hasColumn = (name: string) => columns.some(col => col.name === name)

      if (!hasColumn('birth_date')) {
        db.exec(`ALTER TABLE clients ADD COLUMN birth_date DATE;`)
      }
      if (!hasColumn('doc_type')) {
        db.exec(`ALTER TABLE clients ADD COLUMN doc_type TEXT CHECK (doc_type IN ('passport', 'certificate') OR doc_type IS NULL);`)
      }
      if (!hasColumn('doc_series')) {
        db.exec(`ALTER TABLE clients ADD COLUMN doc_series TEXT;`)
      }
      if (!hasColumn('doc_number')) {
        db.exec(`ALTER TABLE clients ADD COLUMN doc_number TEXT;`)
      }
      if (!hasColumn('doc_issued_by')) {
        db.exec(`ALTER TABLE clients ADD COLUMN doc_issued_by TEXT;`)
      }
      if (!hasColumn('doc_issued_date')) {
        db.exec(`ALTER TABLE clients ADD COLUMN doc_issued_date DATE;`)
      }
      if (!hasColumn('home_address')) {
        db.exec(`ALTER TABLE clients ADD COLUMN home_address TEXT;`)
      }
      if (!hasColumn('workplace')) {
        db.exec(`ALTER TABLE clients ADD COLUMN workplace TEXT;`)
      }
    }
  },
  {
    version: 5,
    name: 'add_lessons_group_date_index',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_lessons_group_date ON lessons(group_id, lesson_date);
      `)
      console.log('Migration 5: Added index for lessons(group_id, lesson_date)')
    }
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
      
      if (typeof migration.up === 'function') {
        migration.up(db)
      } else {
        db.exec(migration.up)
      }
      
      db.prepare('INSERT INTO migrations (version, name) VALUES (?, ?)')
        .run(migration.version, migration.name)
    }
  }
}
