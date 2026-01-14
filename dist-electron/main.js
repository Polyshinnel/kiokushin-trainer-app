import { app as I, BrowserWindow as y, ipcMain as a } from "electron";
import T from "path";
import { fileURLToPath as M } from "url";
import { existsSync as R } from "fs";
import U from "better-sqlite3";
import { createHash as L } from "crypto";
const F = [
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
    up: (t) => {
      t.exec(`
        ALTER TABLE employees ADD COLUMN login TEXT;
        ALTER TABLE employees ADD COLUMN password TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_login ON employees(login) WHERE login IS NOT NULL;
      `);
      const e = L("sha256").update("kiokushinkai_123").digest("hex");
      t.prepare("SELECT id FROM employees WHERE login = ?").get("mishustin_r") ? (t.prepare(`
          UPDATE employees SET password = ? WHERE login = ?
        `).run(e, "mishustin_r"), console.log("Updated password for user: mishustin_r")) : (t.prepare(`
          INSERT INTO employees (full_name, login, password)
          VALUES (?, ?, ?)
        `).run("Мишустин Р.", "mishustin_r", e), console.log("Created default user: mishustin_r"));
    }
  }
];
function w(t) {
  t.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const e = t.prepare("SELECT version FROM migrations").all(), s = new Set(e.map((n) => n.version));
  for (const n of F)
    s.has(n.version) || (console.log(`Applying migration ${n.version}: ${n.name}`), typeof n.up == "function" ? n.up(t) : t.exec(n.up), t.prepare("INSERT INTO migrations (version, name) VALUES (?, ?)").run(n.version, n.name));
}
let c = null;
function H() {
  const t = T.join(I.getPath("userData"), "train-schedule.db");
  return c = new U(t), c.pragma("journal_mode = WAL"), c.pragma("foreign_keys = ON"), w(c), c;
}
function o() {
  if (!c)
    throw new Error("Database not initialized");
  return c;
}
function b() {
  c && (c.close(), c = null);
}
const O = {
  getAll() {
    return o().prepare("SELECT * FROM employees ORDER BY full_name").all();
  },
  getById(t) {
    return o().prepare("SELECT * FROM employees WHERE id = ?").get(t);
  },
  create(t) {
    const e = o(), s = t.password ? L("sha256").update(t.password).digest("hex") : null, r = e.prepare(`
      INSERT INTO employees (full_name, birth_year, phone, login, password)
      VALUES (@full_name, @birth_year, @phone, @login, @password)
    `).run({
      full_name: t.full_name,
      birth_year: t.birth_year ?? null,
      phone: t.phone ?? null,
      login: t.login ?? null,
      password: s
    });
    return this.getById(r.lastInsertRowid);
  },
  update(t, e) {
    const s = o(), n = [], r = { id: t };
    return e.full_name !== void 0 && (n.push("full_name = @full_name"), r.full_name = e.full_name), e.birth_year !== void 0 && (n.push("birth_year = @birth_year"), r.birth_year = e.birth_year), e.phone !== void 0 && (n.push("phone = @phone"), r.phone = e.phone), e.login !== void 0 && (n.push("login = @login"), r.login = e.login), e.password !== void 0 && (n.push("password = @password"), r.password = e.password ? L("sha256").update(e.password).digest("hex") : null), n.length === 0 ? this.getById(t) : (n.push("updated_at = CURRENT_TIMESTAMP"), n.push("sync_status = 'pending'"), s.prepare(`
      UPDATE employees SET ${n.join(", ")} WHERE id = @id
    `).run(r), this.getById(t));
  },
  delete(t) {
    return o().prepare("DELETE FROM employees WHERE id = ?").run(t).changes > 0;
  },
  authenticate(t, e) {
    const s = o(), n = L("sha256").update(e).digest("hex"), r = s.prepare("SELECT * FROM employees WHERE login = ? AND password = ?").get(t, n);
    if (!r) {
      const d = s.prepare("SELECT id, login FROM employees WHERE login = ?").get(t);
      console.log(d ? `User ${t} exists but password doesn't match` : `User ${t} not found`);
    }
    return r || null;
  }
}, _ = {
  getAll(t) {
    const e = o(), s = t?.page || 1, n = t?.limit || 20, r = (s - 1) * n;
    let d = "WHERE 1=1";
    const i = [];
    if (t?.searchQuery) {
      d += " AND (full_name LIKE ? OR phone LIKE ?)";
      const f = `%${t.searchQuery}%`;
      i.push(f, f);
    }
    const p = `SELECT COUNT(*) as total FROM clients ${d}`, m = e.prepare(p).get(...i).total, g = `
      SELECT * FROM clients 
      ${d}
      ORDER BY full_name
      LIMIT ? OFFSET ?
    `;
    return { data: e.prepare(g).all(...i, n, r), total: m };
  },
  getById(t) {
    const e = o(), s = e.prepare("SELECT * FROM clients WHERE id = ?").get(t);
    if (!s) return;
    const n = e.prepare("SELECT * FROM clients_parents WHERE client_id = ?").all(t);
    return { ...s, parents: n };
  },
  getDebtors(t = 30) {
    return o().prepare(`
      SELECT * FROM clients 
      WHERE last_payment_date IS NULL 
         OR date(last_payment_date) < date('now', '-' || ? || ' days')
      ORDER BY last_payment_date ASC
    `).all(t);
  },
  search(t, e) {
    const s = o(), n = e?.page || 1, r = e?.limit || 20, d = (n - 1) * r, i = `%${t}%`, m = s.prepare(`
      SELECT COUNT(*) as total
      FROM clients 
      WHERE full_name LIKE ? OR phone LIKE ?
    `).get(i, i).total;
    return { data: s.prepare(`
      SELECT * FROM clients 
      WHERE full_name LIKE ? OR phone LIKE ?
      ORDER BY full_name
      LIMIT ? OFFSET ?
    `).all(i, i, r, d), total: m };
  },
  create(t) {
    const e = o(), n = e.transaction(() => {
      const i = e.prepare(`
        INSERT INTO clients (full_name, birth_year, phone, last_payment_date)
        VALUES (@full_name, @birth_year, @phone, @last_payment_date)
      `).run({
        full_name: t.full_name,
        birth_year: t.birth_year ?? null,
        phone: t.phone ?? null,
        last_payment_date: t.last_payment_date ?? null
      }).lastInsertRowid;
      if (t.parents && t.parents.length > 0) {
        const p = e.prepare(`
          INSERT INTO clients_parents (client_id, full_name, phone)
          VALUES (@client_id, @full_name, @phone)
        `);
        for (const E of t.parents)
          p.run({
            client_id: i,
            full_name: E.full_name,
            phone: E.phone ?? null
          });
      }
      return i;
    })();
    return this.getById(n);
  },
  update(t, e) {
    const s = o(), n = [], r = { id: t };
    return e.full_name !== void 0 && (n.push("full_name = @full_name"), r.full_name = e.full_name), e.birth_year !== void 0 && (n.push("birth_year = @birth_year"), r.birth_year = e.birth_year), e.phone !== void 0 && (n.push("phone = @phone"), r.phone = e.phone), e.last_payment_date !== void 0 && (n.push("last_payment_date = @last_payment_date"), r.last_payment_date = e.last_payment_date), n.length === 0 ? this.getById(t) : (n.push("updated_at = CURRENT_TIMESTAMP"), n.push("sync_status = 'pending'"), s.prepare(`UPDATE clients SET ${n.join(", ")} WHERE id = @id`).run(r), this.getById(t));
  },
  updatePaymentDate(t, e) {
    o().prepare(`
      UPDATE clients 
      SET last_payment_date = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 'pending'
      WHERE id = ?
    `).run(e, t);
  },
  delete(t) {
    return o().prepare("DELETE FROM clients WHERE id = ?").run(t).changes > 0;
  },
  addParent(t, e) {
    const s = o(), n = s.prepare(`
      INSERT INTO clients_parents (client_id, full_name, phone)
      VALUES (@client_id, @full_name, @phone)
    `).run({
      client_id: t,
      full_name: e.full_name,
      phone: e.phone ?? null
    });
    return s.prepare("SELECT * FROM clients_parents WHERE id = ?").get(n.lastInsertRowid);
  },
  removeParent(t) {
    return o().prepare("DELETE FROM clients_parents WHERE id = ?").run(t).changes > 0;
  }
}, u = {
  getAll() {
    return o().prepare(`
      SELECT 
        g.*,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
      FROM groups g
      LEFT JOIN employees e ON g.trainer_id = e.id
      ORDER BY g.name
    `).all();
  },
  getById(t) {
    const e = o(), s = e.prepare("SELECT * FROM groups WHERE id = ?").get(t);
    if (!s) return;
    const n = s.trainer_id ? e.prepare("SELECT * FROM employees WHERE id = ?").get(s.trainer_id) : void 0, r = e.prepare("SELECT * FROM group_schedule WHERE group_id = ? ORDER BY day_of_week").all(t), d = e.prepare(`
      SELECT gm.*, c.full_name, c.phone, c.birth_year
      FROM group_members gm
      JOIN clients c ON gm.client_id = c.id
      WHERE gm.group_id = ?
      ORDER BY c.full_name
    `).all(t);
    return {
      ...s,
      trainer: n,
      schedule: r,
      members: d.map((i) => ({
        ...i,
        client: {
          id: i.client_id,
          full_name: i.full_name,
          phone: i.phone,
          birth_year: i.birth_year
        }
      })),
      member_count: d.length
    };
  },
  getByTrainer(t) {
    return o().prepare("SELECT * FROM groups WHERE trainer_id = ?").all(t);
  },
  create(t) {
    const e = o(), n = e.transaction(() => {
      const i = e.prepare(`
        INSERT INTO groups (name, start_date, trainer_id)
        VALUES (@name, @start_date, @trainer_id)
      `).run({
        name: t.name,
        start_date: t.start_date ?? null,
        trainer_id: t.trainer_id ?? null
      }).lastInsertRowid;
      if (t.schedule && t.schedule.length > 0) {
        const p = e.prepare(`
          INSERT INTO group_schedule (group_id, day_of_week, start_time, end_time)
          VALUES (@group_id, @day_of_week, @start_time, @end_time)
        `);
        for (const E of t.schedule)
          p.run({
            group_id: i,
            day_of_week: E.day_of_week,
            start_time: E.start_time,
            end_time: E.end_time
          });
      }
      return i;
    })();
    return this.getById(n);
  },
  update(t, e) {
    const s = o(), n = [], r = { id: t };
    return e.name !== void 0 && (n.push("name = @name"), r.name = e.name), e.start_date !== void 0 && (n.push("start_date = @start_date"), r.start_date = e.start_date), e.trainer_id !== void 0 && (n.push("trainer_id = @trainer_id"), r.trainer_id = e.trainer_id), n.length === 0 ? this.getById(t) : (n.push("updated_at = CURRENT_TIMESTAMP"), n.push("sync_status = 'pending'"), s.prepare(`UPDATE groups SET ${n.join(", ")} WHERE id = @id`).run(r), this.getById(t));
  },
  delete(t) {
    return o().prepare("DELETE FROM groups WHERE id = ?").run(t).changes > 0;
  },
  addSchedule(t, e) {
    const s = o(), n = s.prepare(`
      INSERT INTO group_schedule (group_id, day_of_week, start_time, end_time)
      VALUES (@group_id, @day_of_week, @start_time, @end_time)
    `).run({
      group_id: t,
      ...e
    });
    return s.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(t), s.prepare("SELECT * FROM group_schedule WHERE id = ?").get(n.lastInsertRowid);
  },
  updateSchedule(t, e) {
    const s = o(), n = [], r = { id: t };
    e.day_of_week !== void 0 && (n.push("day_of_week = @day_of_week"), r.day_of_week = e.day_of_week), e.start_time !== void 0 && (n.push("start_time = @start_time"), r.start_time = e.start_time), e.end_time !== void 0 && (n.push("end_time = @end_time"), r.end_time = e.end_time), n.length > 0 && (n.push("sync_status = 'pending'"), s.prepare(`UPDATE group_schedule SET ${n.join(", ")} WHERE id = @id`).run(r));
  },
  removeSchedule(t) {
    return o().prepare("DELETE FROM group_schedule WHERE id = ?").run(t).changes > 0;
  },
  addMember(t, e) {
    const s = o(), n = s.prepare(`
      INSERT INTO group_members (group_id, client_id)
      VALUES (?, ?)
    `).run(t, e);
    return s.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(t), s.prepare("SELECT * FROM group_members WHERE id = ?").get(n.lastInsertRowid);
  },
  removeMember(t, e) {
    const s = o(), n = s.prepare("DELETE FROM group_members WHERE group_id = ? AND client_id = ?").run(t, e);
    return n.changes > 0 && s.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(t), n.changes > 0;
  },
  getScheduleForDay(t) {
    return o().prepare(`
      SELECT gs.*, g.name as group_name, e.full_name as trainer_name
      FROM group_schedule gs
      JOIN groups g ON gs.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      WHERE gs.day_of_week = ?
      ORDER BY gs.start_time
    `).all(t);
  }
}, N = {
  getAll(t) {
    const e = o(), s = t?.page || 1, n = t?.limit || 30, r = (s - 1) * n;
    let d = "WHERE 1=1";
    const i = [];
    t?.groupId && (d += " AND l.group_id = ?", i.push(t.groupId)), t?.startDate && (d += " AND l.lesson_date >= ?", i.push(t.startDate)), t?.endDate && (d += " AND l.lesson_date <= ?", i.push(t.endDate));
    const p = `
      SELECT COUNT(*) as total
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      ${d}
    `, m = e.prepare(p).get(...i).total, g = `
      SELECT 
        l.*,
        g.name as group_name,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM attendance WHERE lesson_id = l.id AND status IS NOT NULL) as attendance_count,
        (SELECT COUNT(*) FROM group_members WHERE group_id = l.group_id) as total_members
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      ${d}
      ORDER BY l.lesson_date ASC, l.start_time ASC
      LIMIT ? OFFSET ?
    `;
    return { data: e.prepare(g).all(...i, n, r), total: m };
  },
  getById(t) {
    return o().prepare(`
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
    `).get(t);
  },
  getByDate(t) {
    return o().prepare(`
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
    `).all(t);
  },
  getTodayLessons() {
    return this.getByDate((/* @__PURE__ */ new Date()).toISOString().split("T")[0]);
  },
  create(t) {
    const e = o(), n = e.transaction(() => {
      const d = e.prepare(`
        INSERT INTO lessons (group_id, lesson_date, start_time, end_time)
        VALUES (@group_id, @lesson_date, @start_time, @end_time)
      `).run(t).lastInsertRowid, i = e.prepare("SELECT client_id FROM group_members WHERE group_id = ?").all(t.group_id), p = e.prepare(`
        INSERT INTO attendance (lesson_id, client_id, status)
        VALUES (?, ?, NULL)
      `);
      for (const E of i)
        p.run(d, E.client_id);
      return d;
    })();
    return e.prepare("SELECT * FROM lessons WHERE id = ?").get(n);
  },
  generateFromSchedule(t, e, s) {
    const n = o(), r = n.prepare("SELECT * FROM group_schedule WHERE group_id = ?").all(t);
    if (r.length === 0) return [];
    const d = [], i = new Date(e), p = new Date(s);
    for (let E = new Date(i); E <= p; E.setDate(E.getDate() + 1)) {
      const m = (E.getDay() + 6) % 7, g = r.find((h) => h.day_of_week === m);
      if (g) {
        const h = E.toISOString().split("T")[0];
        if (!n.prepare(`
          SELECT id FROM lessons WHERE group_id = ? AND lesson_date = ?
        `).get(t, h)) {
          const D = this.create({
            group_id: t,
            lesson_date: h,
            start_time: g.start_time,
            end_time: g.end_time
          });
          d.push(D);
        }
      }
    }
    return d;
  },
  delete(t) {
    return o().prepare("DELETE FROM lessons WHERE id = ?").run(t).changes > 0;
  }
}, S = {
  getByLesson(t) {
    return o().prepare(`
      SELECT a.*, c.full_name as client_name, c.phone as client_phone
      FROM attendance a
      JOIN clients c ON a.client_id = c.id
      JOIN lessons l ON a.lesson_id = l.id
      JOIN group_members gm ON l.group_id = gm.group_id AND a.client_id = gm.client_id
      WHERE a.lesson_id = ?
      ORDER BY c.full_name
    `).all(t);
  },
  updateStatus(t, e, s) {
    const n = o();
    return n.prepare(`
      INSERT INTO attendance (lesson_id, client_id, status, updated_at, sync_status)
      VALUES (@lesson_id, @client_id, @status, CURRENT_TIMESTAMP, 'pending')
      ON CONFLICT(lesson_id, client_id) DO UPDATE SET
        status = @status,
        updated_at = CURRENT_TIMESTAMP,
        sync_status = 'pending'
    `).run({ lesson_id: t, client_id: e, status: s }), n.prepare("SELECT * FROM attendance WHERE lesson_id = ? AND client_id = ?").get(t, e);
  },
  getClientAttendance(t, e, s) {
    const n = o();
    let r = `
      SELECT a.*, l.lesson_date, l.start_time, l.end_time, g.name as group_name
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN groups g ON l.group_id = g.id
      WHERE a.client_id = ?
    `;
    const d = [t];
    return e && (r += " AND l.lesson_date >= ?", d.push(e)), s && (r += " AND l.lesson_date <= ?", d.push(s)), r += " ORDER BY l.lesson_date DESC", n.prepare(r).all(...d);
  },
  getStatsByGroup(t) {
    return o().prepare(`
      SELECT 
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN a.status = 'sick' THEN 1 ELSE 0 END) as sick,
        COUNT(*) as total
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.group_id = ?
    `).get(t);
  }
}, A = T.dirname(M(import.meta.url));
let l = null;
function P() {
  a.handle("db:employees:getAll", () => O.getAll()), a.handle("db:employees:getById", (t, e) => O.getById(e)), a.handle("db:employees:create", (t, e) => O.create(e)), a.handle("db:employees:update", (t, e, s) => O.update(e, s)), a.handle("db:employees:delete", (t, e) => O.delete(e)), a.handle("auth:login", (t, e, s) => O.authenticate(e, s)), a.handle("db:clients:getAll", (t, e) => _.getAll(e)), a.handle("db:clients:getById", (t, e) => _.getById(e)), a.handle("db:clients:search", (t, e, s) => _.search(e, s)), a.handle("db:clients:getDebtors", (t, e) => _.getDebtors(e)), a.handle("db:clients:create", (t, e) => _.create(e)), a.handle("db:clients:update", (t, e, s) => _.update(e, s)), a.handle("db:clients:updatePaymentDate", (t, e, s) => _.updatePaymentDate(e, s)), a.handle("db:clients:delete", (t, e) => _.delete(e)), a.handle("db:clients:addParent", (t, e, s) => _.addParent(e, s)), a.handle("db:clients:removeParent", (t, e) => _.removeParent(e)), a.handle("db:groups:getAll", () => u.getAll()), a.handle("db:groups:getById", (t, e) => u.getById(e)), a.handle("db:groups:create", (t, e) => u.create(e)), a.handle("db:groups:update", (t, e, s) => u.update(e, s)), a.handle("db:groups:delete", (t, e) => u.delete(e)), a.handle("db:groups:addSchedule", (t, e, s) => u.addSchedule(e, s)), a.handle("db:groups:updateSchedule", (t, e, s) => u.updateSchedule(e, s)), a.handle("db:groups:removeSchedule", (t, e) => u.removeSchedule(e)), a.handle("db:groups:addMember", (t, e, s) => u.addMember(e, s)), a.handle("db:groups:removeMember", (t, e, s) => u.removeMember(e, s)), a.handle("db:groups:getScheduleForDay", (t, e) => u.getScheduleForDay(e)), a.handle("db:lessons:getAll", (t, e) => N.getAll(e)), a.handle("db:lessons:getById", (t, e) => N.getById(e)), a.handle("db:lessons:getByDate", (t, e) => N.getByDate(e)), a.handle("db:lessons:getTodayLessons", () => N.getTodayLessons()), a.handle("db:lessons:create", (t, e) => N.create(e)), a.handle("db:lessons:generateFromSchedule", (t, e, s, n) => N.generateFromSchedule(e, s, n)), a.handle("db:lessons:delete", (t, e) => N.delete(e)), a.handle("db:attendance:getByLesson", (t, e) => S.getByLesson(e)), a.handle("db:attendance:updateStatus", (t, e, s, n) => S.updateStatus(e, s, n)), a.handle("db:attendance:getClientAttendance", (t, e, s, n) => S.getClientAttendance(e, s, n)), a.handle("db:attendance:getStatsByGroup", (t, e) => S.getStatsByGroup(e)), a.handle("sync:start", () => Promise.resolve()), a.handle("sync:status", () => Promise.resolve("idle"));
}
function C() {
  let t = T.join(A, "preload.cjs");
  if (R(t))
    console.log(`Preload script found at: ${t}`);
  else {
    const e = T.resolve(process.cwd(), "dist-electron", "preload.cjs");
    if (R(e))
      t = e, console.log(`Using alternative preload path: ${t}`);
    else {
      const s = T.join(A, "preload.js"), n = T.resolve(process.cwd(), "dist-electron", "preload.js");
      R(s) ? (t = s, console.log(`Using .js preload path: ${t}`)) : R(n) ? (t = n, console.log(`Using alternative .js preload path: ${t}`)) : (console.error(`Preload script not found at: ${t}`), console.error("Alternative paths also not found"), console.error(`__dirname: ${A}`), console.error(`process.cwd(): ${process.cwd()}`));
    }
  }
  if (l = new y({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    center: !0,
    title: "Kentos Dojo",
    webPreferences: {
      preload: T.resolve(t),
      nodeIntegration: !1,
      contextIsolation: !0,
      devTools: !1
    },
    titleBarStyle: "default",
    show: !0
  }), l.webContents.openDevTools(), l.once("ready-to-show", () => {
    console.log("Window ready to show"), l && (l.show(), l.focus(), l.moveTop());
  }), l.on("closed", () => {
    l = null;
  }), l.webContents.on("did-fail-load", (e, s, n, r) => {
    console.error("Failed to load:", s, n, r), l && l.show();
  }), l.webContents.on("did-finish-load", () => {
    console.log("Page finished loading"), l && !l.isVisible() && (l.show(), l.focus());
  }), process.env.VITE_DEV_SERVER_URL)
    console.log("Loading dev server:", process.env.VITE_DEV_SERVER_URL), l.loadURL(process.env.VITE_DEV_SERVER_URL);
  else {
    const e = I.getAppPath(), s = T.join(e, "dist", "index.html");
    if (console.log("App path:", e), console.log("Loading file:", s), console.log("File exists:", R(s)), R(s))
      l.loadFile(s).catch((n) => {
        console.error("Error loading file:", n), l && l.show();
      });
    else {
      const n = T.join(A, "../dist/index.html");
      console.log("Trying alternative path:", n), console.log("Alternative exists:", R(n)), R(n) ? l.loadFile(n).catch((r) => {
        console.error("Error loading alternative file:", r), l && l.show();
      }) : (console.error("index.html not found in both paths"), l && l.show());
    }
  }
  setTimeout(() => {
    l && (console.log("Force showing window after timeout"), l.isVisible() || l.show(), l.focus(), l.moveTop(), l.setAlwaysOnTop(!0), setTimeout(() => {
      l && l.setAlwaysOnTop(!1);
    }, 1e3));
  }, 2e3);
}
I.whenReady().then(() => {
  H(), P(), C();
});
I.on("window-all-closed", () => {
  process.platform !== "darwin" && (b(), I.quit());
});
I.on("activate", () => {
  y.getAllWindows().length === 0 && C();
});
I.on("before-quit", () => {
  b();
});
