import { app as S, BrowserWindow as v, ipcMain as r } from "electron";
import h from "path";
import { fileURLToPath as W } from "url";
import { existsSync as A } from "fs";
import B from "better-sqlite3";
import { createHash as f } from "crypto";
const P = [
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
    name: "add_employee_login_password",
    up: (s) => {
      s.exec(`
        ALTER TABLE employees ADD COLUMN login TEXT;
        ALTER TABLE employees ADD COLUMN password TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_login ON employees(login) WHERE login IS NOT NULL;
      `);
      const e = f("sha256").update("kiokushinkai_123").digest("hex");
      s.prepare("SELECT id FROM employees WHERE login = ?").get("mishustin_r") ? (s.prepare(`
          UPDATE employees SET password = ? WHERE login = ?
        `).run(e, "mishustin_r"), console.log("Updated password for user: mishustin_r")) : (s.prepare(`
          INSERT INTO employees (full_name, login, password)
          VALUES (?, ?, ?)
        `).run("Мишустин Р.", "mishustin_r", e), console.log("Created default user: mishustin_r"));
    }
  },
  {
    version: 3,
    name: "add_subscriptions",
    up: (s) => {
      s.exec(`
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
      `);
      const t = s.prepare(`
        INSERT INTO subscriptions (name, price, duration_days, visit_limit)
        VALUES ('Все включено', 3500, 30, 0)
      `).run().lastInsertRowid, n = (/* @__PURE__ */ new Date()).toISOString().split("T")[0], i = /* @__PURE__ */ new Date();
      i.setDate(i.getDate() + 30);
      const o = i.toISOString().split("T")[0];
      s.prepare(`
        INSERT INTO client_subscriptions (client_id, subscription_id, start_date, end_date, visits_total, is_paid)
        SELECT id, ?, ?, ?, 0, 1
        FROM clients
      `).run(t, n, o), console.log("Migration 3: Added subscriptions and assigned to all clients");
    }
  },
  {
    version: 4,
    name: "add_client_documents_and_birth_date",
    up: (s) => {
      const e = s.prepare("PRAGMA table_info(clients)").all(), t = (n) => e.some((i) => i.name === n);
      t("birth_date") || s.exec("ALTER TABLE clients ADD COLUMN birth_date DATE;"), t("doc_type") || s.exec("ALTER TABLE clients ADD COLUMN doc_type TEXT CHECK (doc_type IN ('passport', 'certificate') OR doc_type IS NULL);"), t("doc_series") || s.exec("ALTER TABLE clients ADD COLUMN doc_series TEXT;"), t("doc_number") || s.exec("ALTER TABLE clients ADD COLUMN doc_number TEXT;"), t("doc_issued_by") || s.exec("ALTER TABLE clients ADD COLUMN doc_issued_by TEXT;"), t("doc_issued_date") || s.exec("ALTER TABLE clients ADD COLUMN doc_issued_date DATE;"), t("home_address") || s.exec("ALTER TABLE clients ADD COLUMN home_address TEXT;"), t("workplace") || s.exec("ALTER TABLE clients ADD COLUMN workplace TEXT;");
    }
  },
  {
    version: 5,
    name: "add_lessons_group_date_index",
    up: (s) => {
      s.exec(`
        CREATE INDEX IF NOT EXISTS idx_lessons_group_date ON lessons(group_id, lesson_date);
      `), console.log("Migration 5: Added index for lessons(group_id, lesson_date)");
    }
  }
];
function X(s) {
  s.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const e = s.prepare("SELECT version FROM migrations").all(), t = new Set(e.map((n) => n.version));
  for (const n of P)
    t.has(n.version) || (console.log(`Applying migration ${n.version}: ${n.name}`), typeof n.up == "function" ? n.up(s) : s.exec(n.up), s.prepare("INSERT INTO migrations (version, name) VALUES (?, ?)").run(n.version, n.name));
}
let R = null;
function Y() {
  const s = h.join(S.getPath("userData"), "train-schedule.db");
  return R = new B(s), R.pragma("journal_mode = WAL"), R.pragma("foreign_keys = ON"), X(R), R;
}
function a() {
  if (!R)
    throw new Error("Database not initialized");
  return R;
}
function w() {
  R && (R.close(), R = null);
}
const O = {
  getAll() {
    return a().prepare("SELECT * FROM employees ORDER BY full_name").all();
  },
  getById(s) {
    return a().prepare("SELECT * FROM employees WHERE id = ?").get(s);
  },
  create(s) {
    const e = a(), t = s.password ? f("sha256").update(s.password).digest("hex") : null, i = e.prepare(`
      INSERT INTO employees (full_name, birth_year, phone, login, password)
      VALUES (@full_name, @birth_year, @phone, @login, @password)
    `).run({
      full_name: s.full_name,
      birth_year: s.birth_year ?? null,
      phone: s.phone ?? null,
      login: s.login ?? null,
      password: t
    });
    return this.getById(i.lastInsertRowid);
  },
  update(s, e) {
    const t = a(), n = [], i = { id: s };
    return e.full_name !== void 0 && (n.push("full_name = @full_name"), i.full_name = e.full_name), e.birth_year !== void 0 && (n.push("birth_year = @birth_year"), i.birth_year = e.birth_year), e.phone !== void 0 && (n.push("phone = @phone"), i.phone = e.phone), e.login !== void 0 && (n.push("login = @login"), i.login = e.login), e.password !== void 0 && (n.push("password = @password"), i.password = e.password ? f("sha256").update(e.password).digest("hex") : null), n.length === 0 ? this.getById(s) : (n.push("updated_at = CURRENT_TIMESTAMP"), n.push("sync_status = 'pending'"), t.prepare(`
      UPDATE employees SET ${n.join(", ")} WHERE id = @id
    `).run(i), this.getById(s));
  },
  delete(s) {
    return a().prepare("DELETE FROM employees WHERE id = ?").run(s).changes > 0;
  },
  authenticate(s, e) {
    const t = a(), n = f("sha256").update(e).digest("hex"), i = t.prepare("SELECT * FROM employees WHERE login = ? AND password = ?").get(s, n);
    if (!i) {
      const o = t.prepare("SELECT id, login FROM employees WHERE login = ?").get(s);
      console.log(o ? `User ${s} exists but password doesn't match` : `User ${s} not found`);
    }
    return i || null;
  }
}, p = {
  getAll() {
    return a().prepare(`
      SELECT * FROM subscriptions 
      ORDER BY name
    `).all();
  },
  getActive() {
    return a().prepare(`
      SELECT * FROM subscriptions 
      WHERE is_active = 1
      ORDER BY name
    `).all();
  },
  getById(s) {
    return a().prepare("SELECT * FROM subscriptions WHERE id = ?").get(s);
  },
  create(s) {
    const t = a().prepare(`
      INSERT INTO subscriptions (name, price, duration_days, visit_limit)
      VALUES (@name, @price, @duration_days, @visit_limit)
    `).run({
      name: s.name,
      price: s.price,
      duration_days: s.duration_days,
      visit_limit: s.visit_limit ?? 0
    });
    return this.getById(t.lastInsertRowid);
  },
  update(s, e) {
    const t = a(), n = [], i = { id: s };
    return e.name !== void 0 && (n.push("name = @name"), i.name = e.name), e.price !== void 0 && (n.push("price = @price"), i.price = e.price), e.duration_days !== void 0 && (n.push("duration_days = @duration_days"), i.duration_days = e.duration_days), e.visit_limit !== void 0 && (n.push("visit_limit = @visit_limit"), i.visit_limit = e.visit_limit), e.is_active !== void 0 && (n.push("is_active = @is_active"), i.is_active = e.is_active), n.length === 0 ? this.getById(s) : (n.push("updated_at = CURRENT_TIMESTAMP"), n.push("sync_status = 'pending'"), t.prepare(`UPDATE subscriptions SET ${n.join(", ")} WHERE id = @id`).run(i), this.getById(s));
  },
  delete(s) {
    const e = a();
    if (e.prepare(`
      SELECT COUNT(*) as count FROM client_subscriptions 
      WHERE subscription_id = ? AND end_date >= date('now')
    `).get(s).count > 0)
      throw new Error("Невозможно удалить абонемент: есть активные подписки клиентов");
    return e.prepare("DELETE FROM subscriptions WHERE id = ?").run(s).changes > 0;
  },
  getClientSubscriptions(s) {
    return a().prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      WHERE cs.client_id = ?
      ORDER BY cs.start_date DESC
    `).all(s);
  },
  getActiveClientSubscription(s) {
    return a().prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      WHERE cs.client_id = ?
        AND cs.end_date >= date('now')
        AND cs.start_date <= date('now')
        AND (cs.visits_total = 0 OR cs.visits_used < cs.visits_total)
      ORDER BY 
        CASE WHEN cs.is_paid = 1 THEN 0 ELSE 1 END,
        CASE WHEN cs.visits_total > 0 THEN 0 ELSE 1 END,
        cs.end_date ASC,
        cs.start_date DESC
      LIMIT 1
    `).get(s);
  },
  assignSubscription(s) {
    const e = a(), t = this.getById(s.subscription_id);
    if (!t)
      throw new Error("Абонемент не найден");
    const n = new Date(s.start_date), i = new Date(n);
    i.setDate(i.getDate() + t.duration_days);
    const o = e.prepare(`
      INSERT INTO client_subscriptions 
      (client_id, subscription_id, start_date, end_date, visits_total, is_paid, payment_date)
      VALUES (@client_id, @subscription_id, @start_date, @end_date, @visits_total, @is_paid, @payment_date)
    `).run({
      client_id: s.client_id,
      subscription_id: s.subscription_id,
      start_date: s.start_date,
      end_date: i.toISOString().split("T")[0],
      visits_total: t.visit_limit,
      is_paid: s.is_paid ? 1 : 0,
      payment_date: s.is_paid ? s.start_date : null
    });
    return e.prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      WHERE cs.id = ?
    `).get(o.lastInsertRowid);
  },
  markAsPaid(s, e) {
    const t = a(), n = e || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    return t.prepare(`
      UPDATE client_subscriptions 
      SET is_paid = 1, payment_date = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 'pending'
      WHERE id = ?
    `).run(n, s), t.prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      WHERE cs.id = ?
    `).get(s);
  },
  incrementVisit(s) {
    return a().prepare(`
      UPDATE client_subscriptions 
      SET visits_used = visits_used + 1, updated_at = CURRENT_TIMESTAMP, sync_status = 'pending'
      WHERE id = ? AND (visits_total = 0 OR visits_used < visits_total)
    `).run(s).changes > 0;
  },
  removeClientSubscription(s) {
    return a().prepare("DELETE FROM client_subscriptions WHERE id = ?").run(s).changes > 0;
  },
  getUnpaidSubscriptions() {
    return a().prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price, c.full_name as client_name
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      JOIN clients c ON c.id = cs.client_id
      WHERE cs.is_paid = 0 AND cs.end_date >= date('now')
      ORDER BY cs.start_date ASC
    `).all();
  },
  getExpiringSubscriptions(s = 7) {
    return a().prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price, c.full_name as client_name
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      JOIN clients c ON c.id = cs.client_id
      WHERE cs.end_date BETWEEN date('now') AND date('now', '+' || ? || ' days')
        AND (cs.visits_total = 0 OR cs.visits_used < cs.visits_total)
      ORDER BY cs.end_date ASC
    `).all(s);
  }
};
function L(s) {
  if (!s) return null;
  const e = s.trim();
  if (!e) return null;
  if (e.includes(".")) {
    const [n, i, o] = e.split(".");
    if (n && i && o) {
      const d = `${o.padStart(4, "0")}-${i.padStart(2, "0")}-${n.padStart(2, "0")}`, _ = new Date(d);
      return Number.isNaN(_.getTime()) ? null : d;
    }
  }
  const t = new Date(e);
  return Number.isNaN(t.getTime()) ? null : e;
}
function F(s) {
  if (!s) return null;
  const e = new Date(s);
  return Number.isNaN(e.getTime()) ? null : e.getFullYear();
}
function x(s) {
  return s.trim().replace(/\s+/g, " ");
}
const I = `
  LEFT JOIN (
    SELECT 
      cs.client_id,
      cs.id as current_subscription_id,
      cs.subscription_id,
      cs.start_date as current_subscription_start_date,
      cs.end_date as current_subscription_end_date,
      cs.visits_used as current_subscription_visits_used,
      cs.visits_total as current_subscription_visits_total,
      cs.is_paid as current_subscription_is_paid,
      cs.payment_date as current_subscription_payment_date,
      s.name as current_subscription_name,
      s.price as current_subscription_price
    FROM client_subscriptions cs
    JOIN (
      SELECT client_id, MAX(start_date) as max_start
      FROM client_subscriptions
      GROUP BY client_id
    ) latest ON latest.client_id = cs.client_id AND latest.max_start = cs.start_date
    JOIN subscriptions s ON s.id = cs.subscription_id
  ) ls ON ls.client_id = c.id
`, D = `
  CASE
    WHEN ls.current_subscription_id IS NULL THEN 'none'
    WHEN ls.current_subscription_is_paid = 0 THEN 'unpaid'
    WHEN date(ls.current_subscription_end_date) < date('now') THEN 'expired'
    WHEN ls.current_subscription_visits_total > 0 
      AND ls.current_subscription_visits_used >= ls.current_subscription_visits_total THEN 'expired'
    ELSE 'paid'
  END
`;
function M(s) {
  return !s || s === "all" ? "" : s === "active" ? `
      AND ls.current_subscription_id IS NOT NULL
      AND ls.current_subscription_is_paid = 1
      AND date(ls.current_subscription_end_date) >= date('now')
      AND (ls.current_subscription_visits_total = 0 OR ls.current_subscription_visits_used < ls.current_subscription_visits_total)
    ` : s === "expired" ? `
      AND (
        ls.current_subscription_id IS NULL
        OR date(ls.current_subscription_end_date) < date('now')
        OR (ls.current_subscription_visits_total > 0 AND ls.current_subscription_visits_used >= ls.current_subscription_visits_total)
      )
    ` : `
    AND (
      ls.current_subscription_id IS NULL
      OR ls.current_subscription_is_paid = 0
      OR date(ls.current_subscription_end_date) < date('now')
      OR (ls.current_subscription_visits_total > 0 AND ls.current_subscription_visits_used >= ls.current_subscription_visits_total)
    )
  `;
}
const b = {
  getAll(s) {
    const e = a(), t = s?.page || 1, n = s?.limit || 20, i = (t - 1) * n;
    let o = "WHERE 1=1";
    const d = [];
    if (s?.searchQuery) {
      o += " AND (c.full_name LIKE ? OR c.phone LIKE ?)";
      const m = `%${s.searchQuery}%`;
      d.push(m, m);
    }
    s?.subscriptionStatus && s.subscriptionStatus !== "all" && (o += M(s.subscriptionStatus));
    const _ = `
      SELECT COUNT(*) as total 
      FROM clients c
      ${I}
      ${o}
    `, E = e.prepare(_).get(...d).total, u = `
      SELECT 
        c.*,
        ls.current_subscription_id,
        ls.subscription_id as current_subscription_type_id,
        ls.current_subscription_name,
        ls.current_subscription_price,
        ls.current_subscription_start_date,
        ls.current_subscription_end_date,
        ls.current_subscription_visits_used,
        ls.current_subscription_visits_total,
        ls.current_subscription_is_paid,
        ${D} as current_subscription_status
      FROM clients c
      ${I}
      ${o}
      ORDER BY c.full_name
      LIMIT ? OFFSET ?
    `;
    return { data: e.prepare(u).all(...d, n, i), total: E };
  },
  getById(s) {
    const e = a(), t = e.prepare(`
      SELECT 
        c.*,
        ls.current_subscription_id,
        ls.subscription_id as current_subscription_type_id,
        ls.current_subscription_name,
        ls.current_subscription_price,
        ls.current_subscription_start_date,
        ls.current_subscription_end_date,
        ls.current_subscription_visits_used,
        ls.current_subscription_visits_total,
        ls.current_subscription_is_paid,
        ${D} as current_subscription_status
      FROM clients c
      ${I}
      WHERE c.id = ?
    `).get(s);
    if (!t) return;
    const n = e.prepare("SELECT * FROM clients_parents WHERE client_id = ?").all(s);
    return { ...t, parents: n };
  },
  getDebtors(s) {
    const e = a(), t = "WHERE 1=1 " + M("unpaid"), n = `
      SELECT 
        c.*,
        ls.current_subscription_id,
        ls.subscription_id as current_subscription_type_id,
        ls.current_subscription_name,
        ls.current_subscription_price,
        ls.current_subscription_start_date,
        ls.current_subscription_end_date,
        ls.current_subscription_visits_used,
        ls.current_subscription_visits_total,
        ls.current_subscription_is_paid,
        ${D} as current_subscription_status
      FROM clients c
      ${I}
      ${t}
      ORDER BY COALESCE(ls.current_subscription_end_date, c.created_at) ASC
    `;
    return e.prepare(n).all();
  },
  search(s, e) {
    const t = a(), n = e?.page || 1, i = e?.limit || 20, o = (n - 1) * i, d = `%${s}%`;
    let _ = "WHERE (c.full_name LIKE ? OR c.phone LIKE ?)";
    const l = [d, d];
    e?.subscriptionStatus && e.subscriptionStatus !== "all" && (_ += M(e.subscriptionStatus));
    const E = `
      SELECT COUNT(*) as total
      FROM clients c
      ${I}
      ${_}
    `, T = t.prepare(E).get(...l).total, m = `
      SELECT 
        c.*,
        ls.current_subscription_id,
        ls.subscription_id as current_subscription_type_id,
        ls.current_subscription_name,
        ls.current_subscription_price,
        ls.current_subscription_start_date,
        ls.current_subscription_end_date,
        ls.current_subscription_visits_used,
        ls.current_subscription_visits_total,
        ls.current_subscription_is_paid,
        ${D} as current_subscription_status
      FROM clients c
      ${I}
      ${_}
      ORDER BY c.full_name
      LIMIT ? OFFSET ?
    `;
    return { data: t.prepare(m).all(...l, i, o), total: T };
  },
  create(s) {
    const e = a(), n = e.transaction(() => {
      const i = x(s.full_name), o = L(s.birth_date ?? null), d = L(s.doc_issued_date ?? null), _ = s.birth_year !== void 0 ? s.birth_year : F(o);
      if (o) {
        const T = e.prepare(`
          SELECT id, full_name, birth_date 
          FROM clients
          WHERE LOWER(full_name) = LOWER(?) AND birth_date = ?
          LIMIT 1
        `).get(i, o);
        if (T) {
          const m = new Error("CLIENT_DUPLICATE: Клиент с таким ФИО и датой рождения уже существует");
          throw m.code = "CLIENT_DUPLICATE", m.details = T, m;
        }
      }
      const u = e.prepare(`
        INSERT INTO clients (
          full_name, 
          birth_year, 
          birth_date, 
          phone, 
          last_payment_date,
          doc_type,
          doc_series,
          doc_number,
          doc_issued_by,
          doc_issued_date,
          home_address,
          workplace
        )
        VALUES (
          @full_name, 
          @birth_year, 
          @birth_date, 
          @phone, 
          @last_payment_date,
          @doc_type,
          @doc_series,
          @doc_number,
          @doc_issued_by,
          @doc_issued_date,
          @home_address,
          @workplace
        )
      `).run({
        full_name: i,
        birth_year: _ ?? null,
        birth_date: o,
        phone: s.phone ?? null,
        last_payment_date: s.last_payment_date ?? null,
        doc_type: s.doc_type ?? null,
        doc_series: s.doc_series ?? null,
        doc_number: s.doc_number ?? null,
        doc_issued_by: s.doc_issued_by ?? null,
        doc_issued_date: d,
        home_address: s.home_address ?? null,
        workplace: s.workplace ?? null
      }).lastInsertRowid;
      if (s.parents && s.parents.length > 0) {
        const T = e.prepare(`
          INSERT INTO clients_parents (client_id, full_name, phone)
          VALUES (@client_id, @full_name, @phone)
        `);
        for (const m of s.parents)
          T.run({
            client_id: u,
            full_name: m.full_name,
            phone: m.phone ?? null
          });
      }
      return u;
    })();
    if (s.subscription_id) {
      const i = s.subscription_start_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      try {
        p.assignSubscription({
          client_id: n,
          subscription_id: s.subscription_id,
          start_date: i,
          is_paid: !0
        }), e.prepare("UPDATE clients SET last_payment_date = ? WHERE id = ?").run(i, n);
      } catch (o) {
        console.error("Error assigning subscription on client create:", o);
      }
    }
    return this.getById(n);
  },
  update(s, e) {
    const t = a(), n = [], i = { id: s }, o = e.birth_date !== void 0 ? L(e.birth_date) : void 0, d = e.doc_issued_date !== void 0 ? L(e.doc_issued_date) : void 0, _ = e.birth_year !== void 0 ? e.birth_year : o !== void 0 ? F(o) : void 0;
    if (e.full_name !== void 0 && (n.push("full_name = @full_name"), i.full_name = e.full_name), _ !== void 0 && (n.push("birth_year = @birth_year"), i.birth_year = _), o !== void 0 && (n.push("birth_date = @birth_date"), i.birth_date = o), e.phone !== void 0 && (n.push("phone = @phone"), i.phone = e.phone), e.last_payment_date !== void 0 && (n.push("last_payment_date = @last_payment_date"), i.last_payment_date = e.last_payment_date), e.doc_type !== void 0 && (n.push("doc_type = @doc_type"), i.doc_type = e.doc_type ?? null), e.doc_series !== void 0 && (n.push("doc_series = @doc_series"), i.doc_series = e.doc_series ?? null), e.doc_number !== void 0 && (n.push("doc_number = @doc_number"), i.doc_number = e.doc_number ?? null), e.doc_issued_by !== void 0 && (n.push("doc_issued_by = @doc_issued_by"), i.doc_issued_by = e.doc_issued_by ?? null), d !== void 0 && (n.push("doc_issued_date = @doc_issued_date"), i.doc_issued_date = d), e.home_address !== void 0 && (n.push("home_address = @home_address"), i.home_address = e.home_address ?? null), e.workplace !== void 0 && (n.push("workplace = @workplace"), i.workplace = e.workplace ?? null), e.subscription_id !== void 0) {
      n.push("last_payment_date = @last_payment_date");
      const l = e.subscription_start_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      i.last_payment_date = l;
    }
    if (n.length === 0) return this.getById(s);
    if (n.push("updated_at = CURRENT_TIMESTAMP"), n.push("sync_status = 'pending'"), t.prepare(`UPDATE clients SET ${n.join(", ")} WHERE id = @id`).run(i), e.subscription_id !== void 0) {
      const l = e.subscription_start_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], E = p.getClientSubscriptions(s), u = E.length > 0 ? E[0] : void 0;
      if (!u || u.subscription_id !== e.subscription_id)
        try {
          p.assignSubscription({
            client_id: s,
            subscription_id: e.subscription_id,
            start_date: l,
            is_paid: !0
          });
        } catch (T) {
          console.error("Error assigning subscription on client update:", T);
        }
    }
    return this.getById(s);
  },
  updatePaymentDate(s, e) {
    a().prepare(`
      UPDATE clients 
      SET last_payment_date = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 'pending'
      WHERE id = ?
    `).run(e, s);
  },
  delete(s) {
    return a().prepare("DELETE FROM clients WHERE id = ?").run(s).changes > 0;
  },
  addParent(s, e) {
    const t = a(), n = t.prepare(`
      INSERT INTO clients_parents (client_id, full_name, phone)
      VALUES (@client_id, @full_name, @phone)
    `).run({
      client_id: s,
      full_name: e.full_name,
      phone: e.phone ?? null
    });
    return t.prepare("SELECT * FROM clients_parents WHERE id = ?").get(n.lastInsertRowid);
  },
  removeParent(s) {
    return a().prepare("DELETE FROM clients_parents WHERE id = ?").run(s).changes > 0;
  }
}, g = {
  getAll() {
    return a().prepare(`
      SELECT 
        g.*,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
      FROM groups g
      LEFT JOIN employees e ON g.trainer_id = e.id
      ORDER BY g.name
    `).all();
  },
  getById(s) {
    const e = a(), t = e.prepare("SELECT * FROM groups WHERE id = ?").get(s);
    if (!t) return;
    const n = t.trainer_id ? e.prepare("SELECT * FROM employees WHERE id = ?").get(t.trainer_id) : void 0, i = e.prepare("SELECT * FROM group_schedule WHERE group_id = ? ORDER BY day_of_week").all(s), o = e.prepare(`
      SELECT gm.*, c.full_name, c.phone, c.birth_year
      FROM group_members gm
      JOIN clients c ON gm.client_id = c.id
      WHERE gm.group_id = ?
      ORDER BY c.full_name
    `).all(s);
    return {
      ...t,
      trainer: n,
      schedule: i,
      members: o.map((d) => ({
        ...d,
        client: {
          id: d.client_id,
          full_name: d.full_name,
          phone: d.phone,
          birth_year: d.birth_year
        }
      })),
      member_count: o.length
    };
  },
  getByTrainer(s) {
    return a().prepare("SELECT * FROM groups WHERE trainer_id = ?").all(s);
  },
  create(s) {
    const e = a(), n = e.transaction(() => {
      const d = e.prepare(`
        INSERT INTO groups (name, start_date, trainer_id)
        VALUES (@name, @start_date, @trainer_id)
      `).run({
        name: s.name,
        start_date: s.start_date ?? null,
        trainer_id: s.trainer_id ?? null
      }).lastInsertRowid;
      if (s.schedule && s.schedule.length > 0) {
        const _ = e.prepare(`
          INSERT INTO group_schedule (group_id, day_of_week, start_time, end_time)
          VALUES (@group_id, @day_of_week, @start_time, @end_time)
        `);
        for (const l of s.schedule)
          _.run({
            group_id: d,
            day_of_week: l.day_of_week,
            start_time: l.start_time,
            end_time: l.end_time
          });
      }
      return d;
    })();
    return this.getById(n);
  },
  update(s, e) {
    const t = a(), n = [], i = { id: s };
    return e.name !== void 0 && (n.push("name = @name"), i.name = e.name), e.start_date !== void 0 && (n.push("start_date = @start_date"), i.start_date = e.start_date), e.trainer_id !== void 0 && (n.push("trainer_id = @trainer_id"), i.trainer_id = e.trainer_id), n.length === 0 ? this.getById(s) : (n.push("updated_at = CURRENT_TIMESTAMP"), n.push("sync_status = 'pending'"), t.prepare(`UPDATE groups SET ${n.join(", ")} WHERE id = @id`).run(i), this.getById(s));
  },
  delete(s) {
    return a().prepare("DELETE FROM groups WHERE id = ?").run(s).changes > 0;
  },
  addSchedule(s, e) {
    const t = a(), n = t.prepare(`
      INSERT INTO group_schedule (group_id, day_of_week, start_time, end_time)
      VALUES (@group_id, @day_of_week, @start_time, @end_time)
    `).run({
      group_id: s,
      ...e
    });
    return t.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(s), t.prepare("SELECT * FROM group_schedule WHERE id = ?").get(n.lastInsertRowid);
  },
  updateSchedule(s, e) {
    const t = a(), n = [], i = { id: s };
    e.day_of_week !== void 0 && (n.push("day_of_week = @day_of_week"), i.day_of_week = e.day_of_week), e.start_time !== void 0 && (n.push("start_time = @start_time"), i.start_time = e.start_time), e.end_time !== void 0 && (n.push("end_time = @end_time"), i.end_time = e.end_time), n.length > 0 && (n.push("sync_status = 'pending'"), t.prepare(`UPDATE group_schedule SET ${n.join(", ")} WHERE id = @id`).run(i));
  },
  removeSchedule(s) {
    return a().prepare("DELETE FROM group_schedule WHERE id = ?").run(s).changes > 0;
  },
  addMember(s, e) {
    const t = a();
    return t.transaction(() => {
      const o = t.prepare(`
        INSERT INTO group_members (group_id, client_id)
        VALUES (?, ?)
      `).run(s, e).lastInsertRowid, d = t.prepare("SELECT * FROM group_members WHERE id = ?").get(o), _ = t.prepare(`
        SELECT id 
        FROM lessons 
        WHERE group_id = ? AND lesson_date >= ?
      `).all(s, d.joined_at), l = t.prepare(`
        INSERT OR IGNORE INTO attendance (lesson_id, client_id, status)
        VALUES (?, ?, NULL)
      `);
      for (const E of _)
        l.run(E.id, e);
      return t.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(s), d;
    })();
  },
  removeMember(s, e) {
    const t = a(), n = t.prepare("DELETE FROM group_members WHERE group_id = ? AND client_id = ?").run(s, e);
    return n.changes > 0 && t.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(s), n.changes > 0;
  },
  getScheduleForDay(s) {
    return a().prepare(`
      SELECT gs.*, g.name as group_name, e.full_name as trainer_name
      FROM group_schedule gs
      JOIN groups g ON gs.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      WHERE gs.day_of_week = ?
      ORDER BY gs.start_time
    `).all(s);
  }
}, N = {
  getAll(s) {
    const e = a(), t = s?.page || 1, n = s?.limit || 30, i = (t - 1) * n;
    let o = "WHERE 1=1";
    const d = [];
    s?.groupId && (o += " AND l.group_id = ?", d.push(s.groupId)), s?.startDate && (o += " AND l.lesson_date >= ?", d.push(s.startDate)), s?.endDate && (o += " AND l.lesson_date <= ?", d.push(s.endDate));
    const _ = `
      SELECT COUNT(*) as total
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      ${o}
    `, E = e.prepare(_).get(...d).total, u = `
      SELECT 
        l.*,
        g.name as group_name,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM attendance WHERE lesson_id = l.id AND status = 'present') as attendance_count,
        (SELECT COUNT(*) FROM group_members WHERE group_id = l.group_id) as total_members
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      ${o}
      ORDER BY l.lesson_date ASC, l.start_time ASC
      LIMIT ? OFFSET ?
    `;
    return { data: e.prepare(u).all(...d, n, i), total: E };
  },
  getById(s) {
    return a().prepare(`
      SELECT 
        l.*,
        g.name as group_name,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM attendance WHERE lesson_id = l.id AND status = 'present') as attendance_count,
        (SELECT COUNT(*) FROM group_members WHERE group_id = l.group_id) as total_members
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      WHERE l.id = ?
    `).get(s);
  },
  getByDate(s) {
    return a().prepare(`
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
    `).all(s);
  },
  getTodayLessons() {
    return this.getByDate((/* @__PURE__ */ new Date()).toISOString().split("T")[0]);
  },
  create(s) {
    const e = a(), n = e.transaction(() => {
      const o = e.prepare(`
        INSERT INTO lessons (group_id, lesson_date, start_time, end_time)
        VALUES (@group_id, @lesson_date, @start_time, @end_time)
      `).run(s).lastInsertRowid, d = e.prepare("SELECT client_id FROM group_members WHERE group_id = ?").all(s.group_id), _ = e.prepare(`
        INSERT INTO attendance (lesson_id, client_id, status)
        VALUES (?, ?, NULL)
      `);
      for (const l of d)
        _.run(o, l.client_id);
      return o;
    })();
    return e.prepare("SELECT * FROM lessons WHERE id = ?").get(n);
  },
  generateFromSchedule(s, e, t) {
    const n = a(), i = n.prepare("SELECT * FROM group_schedule WHERE group_id = ?").all(s);
    if (i.length === 0) return [];
    const o = [], d = new Date(e), _ = new Date(t);
    for (let l = new Date(d); l <= _; l.setDate(l.getDate() + 1)) {
      const E = (l.getDay() + 6) % 7, u = i.find((T) => T.day_of_week === E);
      if (u) {
        const T = l.toISOString().split("T")[0];
        if (!n.prepare(`
          SELECT id FROM lessons WHERE group_id = ? AND lesson_date = ?
        `).get(s, T)) {
          const U = this.create({
            group_id: s,
            lesson_date: T,
            start_time: u.start_time,
            end_time: u.end_time
          });
          o.push(U);
        }
      }
    }
    return o;
  },
  delete(s) {
    return a().prepare("DELETE FROM lessons WHERE id = ?").run(s).changes > 0;
  },
  /**
   * Получить занятия группы за указанный месяц
   */
  getByGroupAndMonth(s, e, t) {
    const n = a(), i = `${e}-${String(t).padStart(2, "0")}-01`, o = new Date(e, t, 0).getDate(), d = `${e}-${String(t).padStart(2, "0")}-${String(o).padStart(2, "0")}`;
    return n.prepare(`
      SELECT 
        l.*,
        g.name as group_name,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM attendance WHERE lesson_id = l.id AND status = 'present') as attendance_count,
        (SELECT COUNT(*) FROM group_members WHERE group_id = l.group_id) as total_members
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      WHERE l.group_id = ? AND l.lesson_date BETWEEN ? AND ?
      ORDER BY l.lesson_date ASC, l.start_time ASC
    `).all(s, i, d);
  },
  /**
   * Получить полную матрицу посещаемости группы за месяц
   * Возвращает: { lessons: [], members: [], attendance: { lessonId: { clientId: status } } }
   */
  getGroupAttendanceMatrix(s, e, t) {
    const n = a(), i = this.getByGroupAndMonth(s, e, t), o = n.prepare(`
      SELECT gm.client_id, c.full_name as client_name, c.phone as client_phone
      FROM group_members gm
      JOIN clients c ON c.id = gm.client_id
      WHERE gm.group_id = ?
      ORDER BY c.full_name
    `).all(s), d = i.map((u) => u.id);
    if (d.length === 0)
      return { lessons: i, members: o, attendance: {} };
    const _ = d.map(() => "?").join(","), l = n.prepare(`
      SELECT lesson_id, client_id, status
      FROM attendance
      WHERE lesson_id IN (${_})
    `).all(...d), E = {};
    for (const u of l)
      E[u.lesson_id] || (E[u.lesson_id] = {}), E[u.lesson_id][u.client_id] = u.status;
    return { lessons: i, members: o, attendance: E };
  }
}, y = {
  getByLesson(s) {
    return a().prepare(`
      SELECT a.*, c.full_name as client_name, c.phone as client_phone
      FROM attendance a
      JOIN clients c ON a.client_id = c.id
      JOIN lessons l ON a.lesson_id = l.id
      JOIN group_members gm ON l.group_id = gm.group_id AND a.client_id = gm.client_id
      WHERE a.lesson_id = ?
      ORDER BY c.full_name
    `).all(s);
  },
  updateStatus(s, e, t) {
    const n = a();
    return n.prepare(`
      INSERT INTO attendance (lesson_id, client_id, status, updated_at, sync_status)
      VALUES (@lesson_id, @client_id, @status, CURRENT_TIMESTAMP, 'pending')
      ON CONFLICT(lesson_id, client_id) DO UPDATE SET
        status = @status,
        updated_at = CURRENT_TIMESTAMP,
        sync_status = 'pending'
    `).run({ lesson_id: s, client_id: e, status: t }), n.prepare("SELECT * FROM attendance WHERE lesson_id = ? AND client_id = ?").get(s, e);
  },
  getClientAttendance(s, e, t) {
    const n = a();
    let i = `
      SELECT a.*, l.lesson_date, l.start_time, l.end_time, g.name as group_name
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN groups g ON l.group_id = g.id
      WHERE a.client_id = ?
    `;
    const o = [s];
    return e && (i += " AND l.lesson_date >= ?", o.push(e)), t && (i += " AND l.lesson_date <= ?", o.push(t)), i += " ORDER BY l.lesson_date DESC", n.prepare(i).all(...o);
  },
  getStatsByGroup(s) {
    return a().prepare(`
      SELECT 
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN a.status = 'sick' THEN 1 ELSE 0 END) as sick,
        COUNT(*) as total
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.group_id = ?
    `).get(s);
  }
}, C = h.dirname(W(import.meta.url));
let c = null;
function G() {
  r.handle("db:employees:getAll", () => O.getAll()), r.handle("db:employees:getById", (s, e) => O.getById(e)), r.handle("db:employees:create", (s, e) => O.create(e)), r.handle("db:employees:update", (s, e, t) => O.update(e, t)), r.handle("db:employees:delete", (s, e) => O.delete(e)), r.handle("auth:login", (s, e, t) => O.authenticate(e, t)), r.handle("db:clients:getAll", (s, e) => b.getAll(e)), r.handle("db:clients:getById", (s, e) => b.getById(e)), r.handle("db:clients:search", (s, e, t) => b.search(e, t)), r.handle("db:clients:getDebtors", (s, e) => b.getDebtors(e)), r.handle("db:clients:create", (s, e) => b.create(e)), r.handle("db:clients:update", (s, e, t) => b.update(e, t)), r.handle("db:clients:updatePaymentDate", (s, e, t) => b.updatePaymentDate(e, t)), r.handle("db:clients:delete", (s, e) => b.delete(e)), r.handle("db:clients:addParent", (s, e, t) => b.addParent(e, t)), r.handle("db:clients:removeParent", (s, e) => b.removeParent(e)), r.handle("db:subscriptions:getAll", () => p.getAll()), r.handle("db:subscriptions:getActive", () => p.getActive()), r.handle("db:subscriptions:getById", (s, e) => p.getById(e)), r.handle("db:subscriptions:create", (s, e) => p.create(e)), r.handle("db:subscriptions:update", (s, e, t) => p.update(e, t)), r.handle("db:subscriptions:delete", (s, e) => p.delete(e)), r.handle("db:subscriptions:getClientSubscriptions", (s, e) => p.getClientSubscriptions(e)), r.handle("db:subscriptions:getActiveClientSubscription", (s, e) => p.getActiveClientSubscription(e)), r.handle("db:subscriptions:assign", (s, e) => p.assignSubscription(e)), r.handle("db:subscriptions:markAsPaid", (s, e, t) => p.markAsPaid(e, t)), r.handle("db:subscriptions:incrementVisit", (s, e) => p.incrementVisit(e)), r.handle("db:subscriptions:removeClientSubscription", (s, e) => p.removeClientSubscription(e)), r.handle("db:subscriptions:getUnpaid", () => p.getUnpaidSubscriptions()), r.handle("db:subscriptions:getExpiring", (s, e) => p.getExpiringSubscriptions(e)), r.handle("db:groups:getAll", () => g.getAll()), r.handle("db:groups:getById", (s, e) => g.getById(e)), r.handle("db:groups:create", (s, e) => g.create(e)), r.handle("db:groups:update", (s, e, t) => g.update(e, t)), r.handle("db:groups:delete", (s, e) => g.delete(e)), r.handle("db:groups:addSchedule", (s, e, t) => g.addSchedule(e, t)), r.handle("db:groups:updateSchedule", (s, e, t) => g.updateSchedule(e, t)), r.handle("db:groups:removeSchedule", (s, e) => g.removeSchedule(e)), r.handle("db:groups:addMember", (s, e, t) => g.addMember(e, t)), r.handle("db:groups:removeMember", (s, e, t) => g.removeMember(e, t)), r.handle("db:groups:getScheduleForDay", (s, e) => g.getScheduleForDay(e)), r.handle("db:lessons:getAll", (s, e) => N.getAll(e)), r.handle("db:lessons:getById", (s, e) => N.getById(e)), r.handle("db:lessons:getByDate", (s, e) => N.getByDate(e)), r.handle("db:lessons:getTodayLessons", () => N.getTodayLessons()), r.handle("db:lessons:create", (s, e) => N.create(e)), r.handle("db:lessons:generateFromSchedule", (s, e, t, n) => N.generateFromSchedule(e, t, n)), r.handle("db:lessons:delete", (s, e) => N.delete(e)), r.handle("db:lessons:getByGroupAndMonth", (s, e, t, n) => N.getByGroupAndMonth(e, t, n)), r.handle("db:lessons:getGroupAttendanceMatrix", (s, e, t, n) => N.getGroupAttendanceMatrix(e, t, n)), r.handle("db:attendance:getByLesson", (s, e) => y.getByLesson(e)), r.handle("db:attendance:updateStatus", (s, e, t, n) => y.updateStatus(e, t, n)), r.handle("db:attendance:getClientAttendance", (s, e, t, n) => y.getClientAttendance(e, t, n)), r.handle("db:attendance:getStatsByGroup", (s, e) => y.getStatsByGroup(e)), r.handle("sync:start", () => Promise.resolve()), r.handle("sync:status", () => Promise.resolve("idle"));
}
function H() {
  let s = h.join(C, "preload.cjs");
  if (A(s))
    console.log(`Preload script found at: ${s}`);
  else {
    const e = h.resolve(process.cwd(), "dist-electron", "preload.cjs");
    if (A(e))
      s = e, console.log(`Using alternative preload path: ${s}`);
    else {
      const t = h.join(C, "preload.js"), n = h.resolve(process.cwd(), "dist-electron", "preload.js");
      A(t) ? (s = t, console.log(`Using .js preload path: ${s}`)) : A(n) ? (s = n, console.log(`Using alternative .js preload path: ${s}`)) : (console.error(`Preload script not found at: ${s}`), console.error("Alternative paths also not found"), console.error(`__dirname: ${C}`), console.error(`process.cwd(): ${process.cwd()}`));
    }
  }
  if (c = new v({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    center: !0,
    title: "Kentos Dojo",
    webPreferences: {
      preload: h.resolve(s),
      nodeIntegration: !1,
      contextIsolation: !0,
      devTools: !1
    },
    titleBarStyle: "default",
    show: !0
  }), c.webContents.openDevTools(), c.once("ready-to-show", () => {
    console.log("Window ready to show"), c && (c.show(), c.focus(), c.moveTop());
  }), c.on("closed", () => {
    c = null;
  }), c.webContents.on("did-fail-load", (e, t, n, i) => {
    console.error("Failed to load:", t, n, i), c && c.show();
  }), c.webContents.on("did-finish-load", () => {
    console.log("Page finished loading"), c && !c.isVisible() && (c.show(), c.focus());
  }), process.env.VITE_DEV_SERVER_URL)
    console.log("Loading dev server:", process.env.VITE_DEV_SERVER_URL), c.loadURL(process.env.VITE_DEV_SERVER_URL);
  else {
    const e = S.getAppPath(), t = h.join(e, "dist", "index.html");
    if (console.log("App path:", e), console.log("Loading file:", t), console.log("File exists:", A(t)), A(t))
      c.loadFile(t).catch((n) => {
        console.error("Error loading file:", n), c && c.show();
      });
    else {
      const n = h.join(C, "../dist/index.html");
      console.log("Trying alternative path:", n), console.log("Alternative exists:", A(n)), A(n) ? c.loadFile(n).catch((i) => {
        console.error("Error loading alternative file:", i), c && c.show();
      }) : (console.error("index.html not found in both paths"), c && c.show());
    }
  }
  setTimeout(() => {
    c && (console.log("Force showing window after timeout"), c.isVisible() || c.show(), c.focus(), c.moveTop(), c.setAlwaysOnTop(!0), setTimeout(() => {
      c && c.setAlwaysOnTop(!1);
    }, 1e3));
  }, 2e3);
}
S.whenReady().then(() => {
  Y(), G(), H();
});
S.on("window-all-closed", () => {
  process.platform !== "darwin" && (w(), S.quit());
});
S.on("activate", () => {
  v.getAllWindows().length === 0 && H();
});
S.on("before-quit", () => {
  w();
});
