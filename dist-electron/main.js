import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import Database from "better-sqlite3";
import { createHash } from "crypto";
const migrations = [
  {
    version: 1,
    name: "initial_schema",
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
  },
  {
    version: 2,
    name: "add_employee_login_password",
    up: (db2) => {
      db2.exec(`
        ALTER TABLE employees ADD COLUMN login TEXT;
        ALTER TABLE employees ADD COLUMN password TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_login ON employees(login) WHERE login IS NOT NULL;
      `);
      const passwordHash = createHash("sha256").update("kiokushinkai_123").digest("hex");
      const existingUser = db2.prepare("SELECT id FROM employees WHERE login = ?").get("mishustin_r");
      if (!existingUser) {
        db2.prepare(`
          INSERT INTO employees (full_name, login, password)
          VALUES (?, ?, ?)
        `).run("Мишустин Р.", "mishustin_r", passwordHash);
        console.log("Created default user: mishustin_r");
      } else {
        db2.prepare(`
          UPDATE employees SET password = ? WHERE login = ?
        `).run(passwordHash, "mishustin_r");
        console.log("Updated password for user: mishustin_r");
      }
    }
  }
];
function runMigrations(db2) {
  db2.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const appliedMigrations = db2.prepare("SELECT version FROM migrations").all();
  const appliedVersions = new Set(appliedMigrations.map((m) => m.version));
  for (const migration of migrations) {
    if (!appliedVersions.has(migration.version)) {
      console.log(`Applying migration ${migration.version}: ${migration.name}`);
      if (typeof migration.up === "function") {
        migration.up(db2);
      } else {
        db2.exec(migration.up);
      }
      db2.prepare("INSERT INTO migrations (version, name) VALUES (?, ?)").run(migration.version, migration.name);
    }
  }
}
let db = null;
function initDatabase() {
  const dbPath = path.join(app.getPath("userData"), "train-schedule.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}
function getDatabase() {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}
function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
const employeeQueries = {
  getAll() {
    const db2 = getDatabase();
    return db2.prepare("SELECT * FROM employees ORDER BY full_name").all();
  },
  getById(id) {
    const db2 = getDatabase();
    return db2.prepare("SELECT * FROM employees WHERE id = ?").get(id);
  },
  create(data) {
    const db2 = getDatabase();
    const passwordHash = data.password ? createHash("sha256").update(data.password).digest("hex") : null;
    const stmt = db2.prepare(`
      INSERT INTO employees (full_name, birth_year, phone, login, password)
      VALUES (@full_name, @birth_year, @phone, @login, @password)
    `);
    const result = stmt.run({
      full_name: data.full_name,
      birth_year: data.birth_year ?? null,
      phone: data.phone ?? null,
      login: data.login ?? null,
      password: passwordHash
    });
    return this.getById(result.lastInsertRowid);
  },
  update(id, data) {
    const db2 = getDatabase();
    const fields = [];
    const values = { id };
    if (data.full_name !== void 0) {
      fields.push("full_name = @full_name");
      values.full_name = data.full_name;
    }
    if (data.birth_year !== void 0) {
      fields.push("birth_year = @birth_year");
      values.birth_year = data.birth_year;
    }
    if (data.phone !== void 0) {
      fields.push("phone = @phone");
      values.phone = data.phone;
    }
    if (data.login !== void 0) {
      fields.push("login = @login");
      values.login = data.login;
    }
    if (data.password !== void 0) {
      fields.push("password = @password");
      values.password = data.password ? createHash("sha256").update(data.password).digest("hex") : null;
    }
    if (fields.length === 0) return this.getById(id);
    fields.push("updated_at = CURRENT_TIMESTAMP");
    fields.push("sync_status = 'pending'");
    const stmt = db2.prepare(`
      UPDATE employees SET ${fields.join(", ")} WHERE id = @id
    `);
    stmt.run(values);
    return this.getById(id);
  },
  delete(id) {
    const db2 = getDatabase();
    const result = db2.prepare("DELETE FROM employees WHERE id = ?").run(id);
    return result.changes > 0;
  },
  authenticate(login, password) {
    const db2 = getDatabase();
    const passwordHash = createHash("sha256").update(password).digest("hex");
    const employee = db2.prepare("SELECT * FROM employees WHERE login = ? AND password = ?").get(login, passwordHash);
    if (!employee) {
      const userExists = db2.prepare("SELECT id, login FROM employees WHERE login = ?").get(login);
      if (userExists) {
        console.log(`User ${login} exists but password doesn't match`);
      } else {
        console.log(`User ${login} not found`);
      }
    }
    return employee || null;
  }
};
const clientQueries = {
  getAll(filters) {
    const db2 = getDatabase();
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;
    let whereClause = "WHERE 1=1";
    const params = [];
    if (filters?.searchQuery) {
      whereClause += " AND (full_name LIKE ? OR phone LIKE ?)";
      const searchPattern = `%${filters.searchQuery}%`;
      params.push(searchPattern, searchPattern);
    }
    const countQuery = `SELECT COUNT(*) as total FROM clients ${whereClause}`;
    const totalResult = db2.prepare(countQuery).get(...params);
    const total = totalResult.total;
    const dataQuery = `
      SELECT * FROM clients 
      ${whereClause}
      ORDER BY full_name
      LIMIT ? OFFSET ?
    `;
    const data = db2.prepare(dataQuery).all(...params, limit, offset);
    return { data, total };
  },
  getById(id) {
    const db2 = getDatabase();
    const client = db2.prepare("SELECT * FROM clients WHERE id = ?").get(id);
    if (!client) return void 0;
    const parents = db2.prepare("SELECT * FROM clients_parents WHERE client_id = ?").all(id);
    return { ...client, parents };
  },
  getDebtors(daysSincePayment = 30) {
    const db2 = getDatabase();
    return db2.prepare(`
      SELECT * FROM clients 
      WHERE last_payment_date IS NULL 
         OR date(last_payment_date) < date('now', '-' || ? || ' days')
      ORDER BY last_payment_date ASC
    `).all(daysSincePayment);
  },
  search(query, filters) {
    const db2 = getDatabase();
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;
    const searchPattern = `%${query}%`;
    const countQuery = `
      SELECT COUNT(*) as total
      FROM clients 
      WHERE full_name LIKE ? OR phone LIKE ?
    `;
    const totalResult = db2.prepare(countQuery).get(searchPattern, searchPattern);
    const total = totalResult.total;
    const dataQuery = `
      SELECT * FROM clients 
      WHERE full_name LIKE ? OR phone LIKE ?
      ORDER BY full_name
      LIMIT ? OFFSET ?
    `;
    const data = db2.prepare(dataQuery).all(searchPattern, searchPattern, limit, offset);
    return { data, total };
  },
  create(data) {
    const db2 = getDatabase();
    const createClient = db2.transaction(() => {
      const stmt = db2.prepare(`
        INSERT INTO clients (full_name, birth_year, phone, last_payment_date)
        VALUES (@full_name, @birth_year, @phone, @last_payment_date)
      `);
      const result = stmt.run({
        full_name: data.full_name,
        birth_year: data.birth_year ?? null,
        phone: data.phone ?? null,
        last_payment_date: data.last_payment_date ?? null
      });
      const clientId2 = result.lastInsertRowid;
      if (data.parents && data.parents.length > 0) {
        const parentStmt = db2.prepare(`
          INSERT INTO clients_parents (client_id, full_name, phone)
          VALUES (@client_id, @full_name, @phone)
        `);
        for (const parent of data.parents) {
          parentStmt.run({
            client_id: clientId2,
            full_name: parent.full_name,
            phone: parent.phone ?? null
          });
        }
      }
      return clientId2;
    });
    const clientId = createClient();
    return this.getById(clientId);
  },
  update(id, data) {
    const db2 = getDatabase();
    const fields = [];
    const values = { id };
    if (data.full_name !== void 0) {
      fields.push("full_name = @full_name");
      values.full_name = data.full_name;
    }
    if (data.birth_year !== void 0) {
      fields.push("birth_year = @birth_year");
      values.birth_year = data.birth_year;
    }
    if (data.phone !== void 0) {
      fields.push("phone = @phone");
      values.phone = data.phone;
    }
    if (data.last_payment_date !== void 0) {
      fields.push("last_payment_date = @last_payment_date");
      values.last_payment_date = data.last_payment_date;
    }
    if (fields.length === 0) return this.getById(id);
    fields.push("updated_at = CURRENT_TIMESTAMP");
    fields.push("sync_status = 'pending'");
    db2.prepare(`UPDATE clients SET ${fields.join(", ")} WHERE id = @id`).run(values);
    return this.getById(id);
  },
  updatePaymentDate(id, date) {
    const db2 = getDatabase();
    db2.prepare(`
      UPDATE clients 
      SET last_payment_date = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 'pending'
      WHERE id = ?
    `).run(date, id);
  },
  delete(id) {
    const db2 = getDatabase();
    const result = db2.prepare("DELETE FROM clients WHERE id = ?").run(id);
    return result.changes > 0;
  },
  addParent(clientId, data) {
    const db2 = getDatabase();
    const result = db2.prepare(`
      INSERT INTO clients_parents (client_id, full_name, phone)
      VALUES (@client_id, @full_name, @phone)
    `).run({
      client_id: clientId,
      full_name: data.full_name,
      phone: data.phone ?? null
    });
    return db2.prepare("SELECT * FROM clients_parents WHERE id = ?").get(result.lastInsertRowid);
  },
  removeParent(parentId) {
    const db2 = getDatabase();
    const result = db2.prepare("DELETE FROM clients_parents WHERE id = ?").run(parentId);
    return result.changes > 0;
  }
};
const groupQueries = {
  getAll() {
    const db2 = getDatabase();
    return db2.prepare(`
      SELECT 
        g.*,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
      FROM groups g
      LEFT JOIN employees e ON g.trainer_id = e.id
      ORDER BY g.name
    `).all();
  },
  getById(id) {
    const db2 = getDatabase();
    const group = db2.prepare("SELECT * FROM groups WHERE id = ?").get(id);
    if (!group) return void 0;
    const trainer = group.trainer_id ? db2.prepare("SELECT * FROM employees WHERE id = ?").get(group.trainer_id) : void 0;
    const schedule = db2.prepare("SELECT * FROM group_schedule WHERE group_id = ? ORDER BY day_of_week").all(id);
    const members = db2.prepare(`
      SELECT gm.*, c.full_name, c.phone, c.birth_year
      FROM group_members gm
      JOIN clients c ON gm.client_id = c.id
      WHERE gm.group_id = ?
      ORDER BY c.full_name
    `).all(id);
    return {
      ...group,
      trainer,
      schedule,
      members: members.map((m) => ({
        ...m,
        client: {
          id: m.client_id,
          full_name: m.full_name,
          phone: m.phone,
          birth_year: m.birth_year
        }
      })),
      member_count: members.length
    };
  },
  getByTrainer(trainerId) {
    const db2 = getDatabase();
    return db2.prepare("SELECT * FROM groups WHERE trainer_id = ?").all(trainerId);
  },
  create(data) {
    const db2 = getDatabase();
    const createGroup = db2.transaction(() => {
      const stmt = db2.prepare(`
        INSERT INTO groups (name, start_date, trainer_id)
        VALUES (@name, @start_date, @trainer_id)
      `);
      const result = stmt.run({
        name: data.name,
        start_date: data.start_date ?? null,
        trainer_id: data.trainer_id ?? null
      });
      const groupId2 = result.lastInsertRowid;
      if (data.schedule && data.schedule.length > 0) {
        const scheduleStmt = db2.prepare(`
          INSERT INTO group_schedule (group_id, day_of_week, start_time, end_time)
          VALUES (@group_id, @day_of_week, @start_time, @end_time)
        `);
        for (const slot of data.schedule) {
          scheduleStmt.run({
            group_id: groupId2,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time
          });
        }
      }
      return groupId2;
    });
    const groupId = createGroup();
    return this.getById(groupId);
  },
  update(id, data) {
    const db2 = getDatabase();
    const fields = [];
    const values = { id };
    if (data.name !== void 0) {
      fields.push("name = @name");
      values.name = data.name;
    }
    if (data.start_date !== void 0) {
      fields.push("start_date = @start_date");
      values.start_date = data.start_date;
    }
    if (data.trainer_id !== void 0) {
      fields.push("trainer_id = @trainer_id");
      values.trainer_id = data.trainer_id;
    }
    if (fields.length === 0) return this.getById(id);
    fields.push("updated_at = CURRENT_TIMESTAMP");
    fields.push("sync_status = 'pending'");
    db2.prepare(`UPDATE groups SET ${fields.join(", ")} WHERE id = @id`).run(values);
    return this.getById(id);
  },
  delete(id) {
    const db2 = getDatabase();
    const result = db2.prepare("DELETE FROM groups WHERE id = ?").run(id);
    return result.changes > 0;
  },
  addSchedule(groupId, data) {
    const db2 = getDatabase();
    const result = db2.prepare(`
      INSERT INTO group_schedule (group_id, day_of_week, start_time, end_time)
      VALUES (@group_id, @day_of_week, @start_time, @end_time)
    `).run({
      group_id: groupId,
      ...data
    });
    db2.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(groupId);
    return db2.prepare("SELECT * FROM group_schedule WHERE id = ?").get(result.lastInsertRowid);
  },
  updateSchedule(scheduleId, data) {
    const db2 = getDatabase();
    const fields = [];
    const values = { id: scheduleId };
    if (data.day_of_week !== void 0) {
      fields.push("day_of_week = @day_of_week");
      values.day_of_week = data.day_of_week;
    }
    if (data.start_time !== void 0) {
      fields.push("start_time = @start_time");
      values.start_time = data.start_time;
    }
    if (data.end_time !== void 0) {
      fields.push("end_time = @end_time");
      values.end_time = data.end_time;
    }
    if (fields.length > 0) {
      fields.push("sync_status = 'pending'");
      db2.prepare(`UPDATE group_schedule SET ${fields.join(", ")} WHERE id = @id`).run(values);
    }
  },
  removeSchedule(scheduleId) {
    const db2 = getDatabase();
    const result = db2.prepare("DELETE FROM group_schedule WHERE id = ?").run(scheduleId);
    return result.changes > 0;
  },
  addMember(groupId, clientId) {
    const db2 = getDatabase();
    const result = db2.prepare(`
      INSERT INTO group_members (group_id, client_id)
      VALUES (?, ?)
    `).run(groupId, clientId);
    db2.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(groupId);
    return db2.prepare("SELECT * FROM group_members WHERE id = ?").get(result.lastInsertRowid);
  },
  removeMember(groupId, clientId) {
    const db2 = getDatabase();
    const result = db2.prepare("DELETE FROM group_members WHERE group_id = ? AND client_id = ?").run(groupId, clientId);
    if (result.changes > 0) {
      db2.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(groupId);
    }
    return result.changes > 0;
  },
  getScheduleForDay(dayOfWeek) {
    const db2 = getDatabase();
    return db2.prepare(`
      SELECT gs.*, g.name as group_name, e.full_name as trainer_name
      FROM group_schedule gs
      JOIN groups g ON gs.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      WHERE gs.day_of_week = ?
      ORDER BY gs.start_time
    `).all(dayOfWeek);
  }
};
const lessonQueries = {
  getAll(filters) {
    const db2 = getDatabase();
    const page = filters?.page || 1;
    const limit = filters?.limit || 30;
    const offset = (page - 1) * limit;
    let whereClause = "WHERE 1=1";
    const params = [];
    if (filters?.groupId) {
      whereClause += " AND l.group_id = ?";
      params.push(filters.groupId);
    }
    if (filters?.startDate) {
      whereClause += " AND l.lesson_date >= ?";
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      whereClause += " AND l.lesson_date <= ?";
      params.push(filters.endDate);
    }
    const countQuery = `
      SELECT COUNT(*) as total
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      ${whereClause}
    `;
    const totalResult = db2.prepare(countQuery).get(...params);
    const total = totalResult.total;
    const dataQuery = `
      SELECT 
        l.*,
        g.name as group_name,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM attendance WHERE lesson_id = l.id AND status IS NOT NULL) as attendance_count,
        (SELECT COUNT(*) FROM group_members WHERE group_id = l.group_id) as total_members
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      ${whereClause}
      ORDER BY l.lesson_date ASC, l.start_time ASC
      LIMIT ? OFFSET ?
    `;
    const data = db2.prepare(dataQuery).all(...params, limit, offset);
    return { data, total };
  },
  getById(id) {
    const db2 = getDatabase();
    return db2.prepare(`
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
    `).get(id);
  },
  getByDate(date) {
    const db2 = getDatabase();
    return db2.prepare(`
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
    `).all(date);
  },
  getTodayLessons() {
    return this.getByDate((/* @__PURE__ */ new Date()).toISOString().split("T")[0]);
  },
  create(data) {
    const db2 = getDatabase();
    const createLesson = db2.transaction(() => {
      const result = db2.prepare(`
        INSERT INTO lessons (group_id, lesson_date, start_time, end_time)
        VALUES (@group_id, @lesson_date, @start_time, @end_time)
      `).run(data);
      const lessonId2 = result.lastInsertRowid;
      const members = db2.prepare("SELECT client_id FROM group_members WHERE group_id = ?").all(data.group_id);
      const attendanceStmt = db2.prepare(`
        INSERT INTO attendance (lesson_id, client_id, status)
        VALUES (?, ?, NULL)
      `);
      for (const member of members) {
        attendanceStmt.run(lessonId2, member.client_id);
      }
      return lessonId2;
    });
    const lessonId = createLesson();
    return db2.prepare("SELECT * FROM lessons WHERE id = ?").get(lessonId);
  },
  generateFromSchedule(groupId, startDate, endDate) {
    const db2 = getDatabase();
    const schedule = db2.prepare("SELECT * FROM group_schedule WHERE group_id = ?").all(groupId);
    if (schedule.length === 0) return [];
    const createdLessons = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = (date.getDay() + 6) % 7;
      const daySchedule = schedule.find((s) => s.day_of_week === dayOfWeek);
      if (daySchedule) {
        const lessonDate = date.toISOString().split("T")[0];
        const existing = db2.prepare(`
          SELECT id FROM lessons WHERE group_id = ? AND lesson_date = ?
        `).get(groupId, lessonDate);
        if (!existing) {
          const lesson = this.create({
            group_id: groupId,
            lesson_date: lessonDate,
            start_time: daySchedule.start_time,
            end_time: daySchedule.end_time
          });
          createdLessons.push(lesson);
        }
      }
    }
    return createdLessons;
  },
  delete(id) {
    const db2 = getDatabase();
    const result = db2.prepare("DELETE FROM lessons WHERE id = ?").run(id);
    return result.changes > 0;
  }
};
const attendanceQueries = {
  getByLesson(lessonId) {
    const db2 = getDatabase();
    return db2.prepare(`
      SELECT a.*, c.full_name as client_name, c.phone as client_phone
      FROM attendance a
      JOIN clients c ON a.client_id = c.id
      JOIN lessons l ON a.lesson_id = l.id
      JOIN group_members gm ON l.group_id = gm.group_id AND a.client_id = gm.client_id
      WHERE a.lesson_id = ?
      ORDER BY c.full_name
    `).all(lessonId);
  },
  updateStatus(lessonId, clientId, status) {
    const db2 = getDatabase();
    db2.prepare(`
      INSERT INTO attendance (lesson_id, client_id, status, updated_at, sync_status)
      VALUES (@lesson_id, @client_id, @status, CURRENT_TIMESTAMP, 'pending')
      ON CONFLICT(lesson_id, client_id) DO UPDATE SET
        status = @status,
        updated_at = CURRENT_TIMESTAMP,
        sync_status = 'pending'
    `).run({ lesson_id: lessonId, client_id: clientId, status });
    return db2.prepare("SELECT * FROM attendance WHERE lesson_id = ? AND client_id = ?").get(lessonId, clientId);
  },
  getClientAttendance(clientId, startDate, endDate) {
    const db2 = getDatabase();
    let query = `
      SELECT a.*, l.lesson_date, l.start_time, l.end_time, g.name as group_name
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN groups g ON l.group_id = g.id
      WHERE a.client_id = ?
    `;
    const params = [clientId];
    if (startDate) {
      query += " AND l.lesson_date >= ?";
      params.push(startDate);
    }
    if (endDate) {
      query += " AND l.lesson_date <= ?";
      params.push(endDate);
    }
    query += " ORDER BY l.lesson_date DESC";
    return db2.prepare(query).all(...params);
  },
  getStatsByGroup(groupId) {
    const db2 = getDatabase();
    const result = db2.prepare(`
      SELECT 
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN a.status = 'sick' THEN 1 ELSE 0 END) as sick,
        COUNT(*) as total
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.group_id = ?
    `).get(groupId);
    return result;
  }
};
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
let mainWindow = null;
function setupIpcHandlers() {
  ipcMain.handle("db:employees:getAll", () => employeeQueries.getAll());
  ipcMain.handle("db:employees:getById", (_, id) => employeeQueries.getById(id));
  ipcMain.handle("db:employees:create", (_, data) => employeeQueries.create(data));
  ipcMain.handle("db:employees:update", (_, id, data) => employeeQueries.update(id, data));
  ipcMain.handle("db:employees:delete", (_, id) => employeeQueries.delete(id));
  ipcMain.handle("auth:login", (_, login, password) => employeeQueries.authenticate(login, password));
  ipcMain.handle("db:clients:getAll", (_, filters) => clientQueries.getAll(filters));
  ipcMain.handle("db:clients:getById", (_, id) => clientQueries.getById(id));
  ipcMain.handle("db:clients:search", (_, query, filters) => clientQueries.search(query, filters));
  ipcMain.handle("db:clients:getDebtors", (_, days) => clientQueries.getDebtors(days));
  ipcMain.handle("db:clients:create", (_, data) => clientQueries.create(data));
  ipcMain.handle("db:clients:update", (_, id, data) => clientQueries.update(id, data));
  ipcMain.handle("db:clients:updatePaymentDate", (_, id, date) => clientQueries.updatePaymentDate(id, date));
  ipcMain.handle("db:clients:delete", (_, id) => clientQueries.delete(id));
  ipcMain.handle("db:clients:addParent", (_, clientId, data) => clientQueries.addParent(clientId, data));
  ipcMain.handle("db:clients:removeParent", (_, parentId) => clientQueries.removeParent(parentId));
  ipcMain.handle("db:groups:getAll", () => groupQueries.getAll());
  ipcMain.handle("db:groups:getById", (_, id) => groupQueries.getById(id));
  ipcMain.handle("db:groups:create", (_, data) => groupQueries.create(data));
  ipcMain.handle("db:groups:update", (_, id, data) => groupQueries.update(id, data));
  ipcMain.handle("db:groups:delete", (_, id) => groupQueries.delete(id));
  ipcMain.handle("db:groups:addSchedule", (_, groupId, data) => groupQueries.addSchedule(groupId, data));
  ipcMain.handle("db:groups:updateSchedule", (_, scheduleId, data) => groupQueries.updateSchedule(scheduleId, data));
  ipcMain.handle("db:groups:removeSchedule", (_, scheduleId) => groupQueries.removeSchedule(scheduleId));
  ipcMain.handle("db:groups:addMember", (_, groupId, clientId) => groupQueries.addMember(groupId, clientId));
  ipcMain.handle("db:groups:removeMember", (_, groupId, clientId) => groupQueries.removeMember(groupId, clientId));
  ipcMain.handle("db:groups:getScheduleForDay", (_, day) => groupQueries.getScheduleForDay(day));
  ipcMain.handle("db:lessons:getAll", (_, filters) => lessonQueries.getAll(filters));
  ipcMain.handle("db:lessons:getById", (_, id) => lessonQueries.getById(id));
  ipcMain.handle("db:lessons:getByDate", (_, date) => lessonQueries.getByDate(date));
  ipcMain.handle("db:lessons:getTodayLessons", () => lessonQueries.getTodayLessons());
  ipcMain.handle("db:lessons:create", (_, data) => lessonQueries.create(data));
  ipcMain.handle("db:lessons:generateFromSchedule", (_, groupId, startDate, endDate) => lessonQueries.generateFromSchedule(groupId, startDate, endDate));
  ipcMain.handle("db:lessons:delete", (_, id) => lessonQueries.delete(id));
  ipcMain.handle("db:attendance:getByLesson", (_, lessonId) => attendanceQueries.getByLesson(lessonId));
  ipcMain.handle("db:attendance:updateStatus", (_, lessonId, clientId, status) => attendanceQueries.updateStatus(lessonId, clientId, status));
  ipcMain.handle("db:attendance:getClientAttendance", (_, clientId, startDate, endDate) => attendanceQueries.getClientAttendance(clientId, startDate, endDate));
  ipcMain.handle("db:attendance:getStatsByGroup", (_, groupId) => attendanceQueries.getStatsByGroup(groupId));
  ipcMain.handle("sync:start", () => {
    return Promise.resolve();
  });
  ipcMain.handle("sync:status", () => {
    return Promise.resolve("idle");
  });
}
function createWindow() {
  let preloadPath = path.join(__dirname$1, "preload.cjs");
  if (!existsSync(preloadPath)) {
    const altPath = path.resolve(process.cwd(), "dist-electron", "preload.cjs");
    if (existsSync(altPath)) {
      preloadPath = altPath;
      console.log(`Using alternative preload path: ${preloadPath}`);
    } else {
      const jsPath = path.join(__dirname$1, "preload.js");
      const jsAltPath = path.resolve(process.cwd(), "dist-electron", "preload.js");
      if (existsSync(jsPath)) {
        preloadPath = jsPath;
        console.log(`Using .js preload path: ${preloadPath}`);
      } else if (existsSync(jsAltPath)) {
        preloadPath = jsAltPath;
        console.log(`Using alternative .js preload path: ${preloadPath}`);
      } else {
        console.error(`Preload script not found at: ${preloadPath}`);
        console.error(`Alternative paths also not found`);
        console.error(`__dirname: ${__dirname$1}`);
        console.error(`process.cwd(): ${process.cwd()}`);
      }
    }
  } else {
    console.log(`Preload script found at: ${preloadPath}`);
  }
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.resolve(preloadPath),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: "default",
    show: false
  });
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname$1, "../dist/index.html"));
  }
}
app.whenReady().then(() => {
  initDatabase();
  setupIpcHandlers();
  createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    closeDatabase();
    app.quit();
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.on("before-quit", () => {
  closeDatabase();
});
