import { app as O, BrowserWindow as v, ipcMain as o } from "electron";
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
      `).run().lastInsertRowid, i = (/* @__PURE__ */ new Date()).toISOString().split("T")[0], n = /* @__PURE__ */ new Date();
      n.setDate(n.getDate() + 30);
      const r = n.toISOString().split("T")[0];
      s.prepare(`
        INSERT INTO client_subscriptions (client_id, subscription_id, start_date, end_date, visits_total, is_paid)
        SELECT id, ?, ?, ?, 0, 1
        FROM clients
      `).run(t, i, r), console.log("Migration 3: Added subscriptions and assigned to all clients");
    }
  },
  {
    version: 4,
    name: "add_client_documents_and_birth_date",
    up: (s) => {
      const e = s.prepare("PRAGMA table_info(clients)").all(), t = (i) => e.some((n) => n.name === i);
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
  },
  {
    version: 6,
    name: "dedupe_client_subscriptions",
    up: (s) => {
      const e = s.prepare(`
        SELECT client_id, subscription_id, start_date, MAX(visits_used) as max_visits_used
        FROM client_subscriptions
        GROUP BY client_id, subscription_id, start_date
        HAVING COUNT(*) > 1
      `).all();
      if (e.length === 0) return;
      const t = s.prepare(`
        SELECT id
        FROM client_subscriptions
        WHERE client_id = ? AND subscription_id = ? AND start_date = ? AND visits_used = ?
        ORDER BY id DESC
        LIMIT 1
      `), i = s.prepare(`
        UPDATE client_subscriptions
        SET visits_used = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 'pending'
        WHERE id = ?
      `), n = s.prepare(`
        DELETE FROM client_subscriptions
        WHERE client_id = ? AND subscription_id = ? AND start_date = ? AND id != ?
      `);
      s.transaction(() => {
        for (const a of e) {
          const c = t.get(
            a.client_id,
            a.subscription_id,
            a.start_date,
            a.max_visits_used
          );
          c && (i.run(a.max_visits_used, c.id), n.run(a.client_id, a.subscription_id, a.start_date, c.id));
        }
      })(), console.log(`Migration 6: Deduped client_subscriptions (${e.length} groups)`);
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
  const e = s.prepare("SELECT version FROM migrations").all(), t = new Set(e.map((i) => i.version));
  for (const i of P)
    t.has(i.version) || (console.log(`Applying migration ${i.version}: ${i.name}`), typeof i.up == "function" ? i.up(s) : s.exec(i.up), s.prepare("INSERT INTO migrations (version, name) VALUES (?, ?)").run(i.version, i.name));
}
let g = null;
function x() {
  const s = h.join(O.getPath("userData"), "train-schedule.db");
  return g = new B(s), g.pragma("journal_mode = WAL"), g.pragma("foreign_keys = ON"), X(g), g;
}
function d() {
  if (!g)
    throw new Error("Database not initialized");
  return g;
}
function w() {
  g && (g.close(), g = null);
}
const S = {
  getAll() {
    return d().prepare("SELECT * FROM employees ORDER BY full_name").all();
  },
  getById(s) {
    return d().prepare("SELECT * FROM employees WHERE id = ?").get(s);
  },
  create(s) {
    const e = d(), t = s.password ? f("sha256").update(s.password).digest("hex") : null, n = e.prepare(`
      INSERT INTO employees (full_name, birth_year, phone, login, password)
      VALUES (@full_name, @birth_year, @phone, @login, @password)
    `).run({
      full_name: s.full_name,
      birth_year: s.birth_year ?? null,
      phone: s.phone ?? null,
      login: s.login ?? null,
      password: t
    });
    return this.getById(n.lastInsertRowid);
  },
  update(s, e) {
    const t = d(), i = [], n = { id: s };
    return e.full_name !== void 0 && (i.push("full_name = @full_name"), n.full_name = e.full_name), e.birth_year !== void 0 && (i.push("birth_year = @birth_year"), n.birth_year = e.birth_year), e.phone !== void 0 && (i.push("phone = @phone"), n.phone = e.phone), e.login !== void 0 && (i.push("login = @login"), n.login = e.login), e.password !== void 0 && (i.push("password = @password"), n.password = e.password ? f("sha256").update(e.password).digest("hex") : null), i.length === 0 ? this.getById(s) : (i.push("updated_at = CURRENT_TIMESTAMP"), i.push("sync_status = 'pending'"), t.prepare(`
      UPDATE employees SET ${i.join(", ")} WHERE id = @id
    `).run(n), this.getById(s));
  },
  delete(s) {
    return d().prepare("DELETE FROM employees WHERE id = ?").run(s).changes > 0;
  },
  authenticate(s, e) {
    const t = d(), i = f("sha256").update(e).digest("hex"), n = t.prepare("SELECT * FROM employees WHERE login = ? AND password = ?").get(s, i);
    if (!n) {
      const r = t.prepare("SELECT id, login FROM employees WHERE login = ?").get(s);
      console.log(r ? `User ${s} exists but password doesn't match` : `User ${s} not found`);
    }
    return n || null;
  }
}, T = {
  getAll() {
    return d().prepare(`
      SELECT * FROM subscriptions 
      ORDER BY name
    `).all();
  },
  getActive() {
    return d().prepare(`
      SELECT * FROM subscriptions 
      WHERE is_active = 1
      ORDER BY name
    `).all();
  },
  getById(s) {
    return d().prepare("SELECT * FROM subscriptions WHERE id = ?").get(s);
  },
  create(s) {
    const t = d().prepare(`
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
    const t = d(), i = [], n = { id: s };
    return e.name !== void 0 && (i.push("name = @name"), n.name = e.name), e.price !== void 0 && (i.push("price = @price"), n.price = e.price), e.duration_days !== void 0 && (i.push("duration_days = @duration_days"), n.duration_days = e.duration_days), e.visit_limit !== void 0 && (i.push("visit_limit = @visit_limit"), n.visit_limit = e.visit_limit), e.is_active !== void 0 && (i.push("is_active = @is_active"), n.is_active = e.is_active), i.length === 0 ? this.getById(s) : (i.push("updated_at = CURRENT_TIMESTAMP"), i.push("sync_status = 'pending'"), t.prepare(`UPDATE subscriptions SET ${i.join(", ")} WHERE id = @id`).run(n), this.getById(s));
  },
  delete(s) {
    const e = d();
    if (e.prepare(`
      SELECT COUNT(*) as count FROM client_subscriptions 
      WHERE subscription_id = ? AND end_date >= date('now')
    `).get(s).count > 0)
      throw new Error("Невозможно удалить абонемент: есть активные подписки клиентов");
    return e.prepare("DELETE FROM subscriptions WHERE id = ?").run(s).changes > 0;
  },
  getClientSubscriptions(s) {
    return d().prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      WHERE cs.client_id = ?
      ORDER BY cs.start_date DESC
    `).all(s);
  },
  getActiveClientSubscription(s) {
    return d().prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      WHERE cs.client_id = ?
        AND cs.end_date >= date('now')
        AND cs.start_date <= date('now')
        AND (cs.visits_total = 0 OR cs.visits_used < cs.visits_total)
        AND NOT EXISTS (
          SELECT 1
          FROM client_subscriptions cs2
          WHERE cs2.client_id = cs.client_id
            AND cs2.subscription_id = cs.subscription_id
            AND cs2.start_date = cs.start_date
            AND cs2.visits_used > cs.visits_used
        )
      ORDER BY 
        CASE WHEN cs.is_paid = 1 THEN 0 ELSE 1 END,
        CASE WHEN cs.visits_total > 0 THEN 0 ELSE 1 END,
        cs.end_date ASC,
        cs.start_date DESC,
        cs.id DESC
      LIMIT 1
    `).get(s);
  },
  assignSubscription(s) {
    const e = d(), t = this.getById(s.subscription_id);
    if (!t)
      throw new Error("Абонемент не найден");
    const i = new Date(s.start_date), n = new Date(i);
    n.setDate(n.getDate() + t.duration_days);
    const r = s.start_date, a = n.toISOString().split("T")[0], c = e.prepare(`
      SELECT id, visits_used, visits_total, end_date
      FROM client_subscriptions
      WHERE client_id = ? AND subscription_id = ? AND start_date = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(s.client_id, s.subscription_id, r);
    if (c) {
      const p = c.visits_total > 0 && c.visits_used >= c.visits_total, u = new Date(c.end_date) < new Date(r), E = p || u ? 0 : c.visits_used;
      return e.prepare(`
        UPDATE client_subscriptions
        SET end_date = ?,
            visits_used = ?,
            visits_total = ?,
            is_paid = ?,
            payment_date = ?,
            updated_at = CURRENT_TIMESTAMP,
            sync_status = 'pending'
        WHERE id = ?
      `).run(
        a,
        E,
        t.visit_limit,
        s.is_paid ? 1 : 0,
        s.is_paid ? r : null,
        c.id
      ), e.prepare(`
        SELECT cs.*, s.name as subscription_name, s.price as subscription_price
        FROM client_subscriptions cs
        JOIN subscriptions s ON s.id = cs.subscription_id
        WHERE cs.id = ?
      `).get(c.id);
    }
    const l = e.prepare(`
      INSERT INTO client_subscriptions 
      (client_id, subscription_id, start_date, end_date, visits_total, is_paid, payment_date)
      VALUES (@client_id, @subscription_id, @start_date, @end_date, @visits_total, @is_paid, @payment_date)
    `).run({
      client_id: s.client_id,
      subscription_id: s.subscription_id,
      start_date: r,
      end_date: a,
      visits_total: t.visit_limit,
      is_paid: s.is_paid ? 1 : 0,
      payment_date: s.is_paid ? r : null
    });
    return e.prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      WHERE cs.id = ?
    `).get(l.lastInsertRowid);
  },
  markAsPaid(s, e) {
    const t = d(), i = e || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    return t.prepare(`
      UPDATE client_subscriptions 
      SET is_paid = 1, payment_date = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 'pending'
      WHERE id = ?
    `).run(i, s), t.prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      WHERE cs.id = ?
    `).get(s);
  },
  incrementVisit(s) {
    return d().prepare(`
      UPDATE client_subscriptions 
      SET visits_used = visits_used + 1, updated_at = CURRENT_TIMESTAMP, sync_status = 'pending'
      WHERE id = ? AND (visits_total = 0 OR visits_used < visits_total)
    `).run(s).changes > 0;
  },
  removeClientSubscription(s) {
    return d().prepare("DELETE FROM client_subscriptions WHERE id = ?").run(s).changes > 0;
  },
  getUnpaidSubscriptions() {
    return d().prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price, c.full_name as client_name
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      JOIN clients c ON c.id = cs.client_id
      WHERE cs.is_paid = 0 AND cs.end_date >= date('now')
      ORDER BY cs.start_date ASC
    `).all();
  },
  getExpiringSubscriptions(s = 7) {
    return d().prepare(`
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
    const [i, n, r] = e.split(".");
    if (i && n && r) {
      const a = `${r.padStart(4, "0")}-${n.padStart(2, "0")}-${i.padStart(2, "0")}`, c = new Date(a);
      return Number.isNaN(c.getTime()) ? null : a;
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
function Y(s) {
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
      WHERE date(start_date) <= date('now')
      GROUP BY client_id
    ) latest ON latest.client_id = cs.client_id AND latest.max_start = cs.start_date
    JOIN (
      SELECT client_id, start_date, MAX(id) as max_id
      FROM client_subscriptions
      WHERE date(start_date) <= date('now')
      GROUP BY client_id, start_date
    ) latest_id ON latest_id.client_id = cs.client_id
      AND latest_id.start_date = cs.start_date
      AND latest_id.max_id = cs.id
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
const m = {
  getAll(s) {
    const e = d(), t = s?.page || 1, i = s?.limit || 20, n = (t - 1) * i;
    let r = "WHERE 1=1";
    const a = [];
    if (s?.searchQuery) {
      r += " AND (c.full_name LIKE ? OR c.phone LIKE ?)";
      const R = `%${s.searchQuery}%`;
      a.push(R, R);
    }
    s?.subscriptionStatus && s.subscriptionStatus !== "all" && (r += M(s.subscriptionStatus));
    const c = `
      SELECT COUNT(*) as total 
      FROM clients c
      ${I}
      ${r}
    `, p = e.prepare(c).get(...a).total, u = `
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
      ${r}
      ORDER BY c.full_name
      LIMIT ? OFFSET ?
    `;
    return { data: e.prepare(u).all(...a, i, n), total: p };
  },
  getById(s) {
    const e = d(), t = e.prepare(`
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
    const i = e.prepare("SELECT * FROM clients_parents WHERE client_id = ?").all(s);
    return { ...t, parents: i };
  },
  getDebtors(s) {
    const e = d(), t = "WHERE 1=1 " + M("unpaid"), i = `
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
    return e.prepare(i).all();
  },
  search(s, e) {
    const t = d(), i = e?.page || 1, n = e?.limit || 20, r = (i - 1) * n, a = `%${s}%`;
    let c = "WHERE (c.full_name LIKE ? OR c.phone LIKE ?)";
    const l = [a, a];
    e?.subscriptionStatus && e.subscriptionStatus !== "all" && (c += M(e.subscriptionStatus));
    const p = `
      SELECT COUNT(*) as total
      FROM clients c
      ${I}
      ${c}
    `, E = t.prepare(p).get(...l).total, R = `
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
      ${c}
      ORDER BY c.full_name
      LIMIT ? OFFSET ?
    `;
    return { data: t.prepare(R).all(...l, n, r), total: E };
  },
  create(s) {
    const e = d(), i = e.transaction(() => {
      const n = Y(s.full_name), r = L(s.birth_date ?? null), a = L(s.doc_issued_date ?? null), c = s.birth_year !== void 0 ? s.birth_year : F(r);
      if (r) {
        const E = e.prepare(`
          SELECT id, full_name, birth_date 
          FROM clients
          WHERE LOWER(full_name) = LOWER(?) AND birth_date = ?
          LIMIT 1
        `).get(n, r);
        if (E) {
          const R = new Error("CLIENT_DUPLICATE: Клиент с таким ФИО и датой рождения уже существует");
          throw R.code = "CLIENT_DUPLICATE", R.details = E, R;
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
        full_name: n,
        birth_year: c ?? null,
        birth_date: r,
        phone: s.phone ?? null,
        last_payment_date: s.last_payment_date ?? null,
        doc_type: s.doc_type ?? null,
        doc_series: s.doc_series ?? null,
        doc_number: s.doc_number ?? null,
        doc_issued_by: s.doc_issued_by ?? null,
        doc_issued_date: a,
        home_address: s.home_address ?? null,
        workplace: s.workplace ?? null
      }).lastInsertRowid;
      if (s.parents && s.parents.length > 0) {
        const E = e.prepare(`
          INSERT INTO clients_parents (client_id, full_name, phone)
          VALUES (@client_id, @full_name, @phone)
        `);
        for (const R of s.parents)
          E.run({
            client_id: u,
            full_name: R.full_name,
            phone: R.phone ?? null
          });
      }
      return u;
    })();
    if (s.subscription_id) {
      const n = s.subscription_start_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      try {
        T.assignSubscription({
          client_id: i,
          subscription_id: s.subscription_id,
          start_date: n,
          is_paid: !0
        }), e.prepare("UPDATE clients SET last_payment_date = ? WHERE id = ?").run(n, i);
      } catch (r) {
        console.error("Error assigning subscription on client create:", r);
      }
    }
    return this.getById(i);
  },
  update(s, e) {
    const t = d(), i = [], n = { id: s }, r = e.birth_date !== void 0 ? L(e.birth_date) : void 0, a = e.doc_issued_date !== void 0 ? L(e.doc_issued_date) : void 0, c = e.birth_year !== void 0 ? e.birth_year : r !== void 0 ? F(r) : void 0;
    if (e.full_name !== void 0 && (i.push("full_name = @full_name"), n.full_name = e.full_name), c !== void 0 && (i.push("birth_year = @birth_year"), n.birth_year = c), r !== void 0 && (i.push("birth_date = @birth_date"), n.birth_date = r), e.phone !== void 0 && (i.push("phone = @phone"), n.phone = e.phone), e.last_payment_date !== void 0 && (i.push("last_payment_date = @last_payment_date"), n.last_payment_date = e.last_payment_date), e.doc_type !== void 0 && (i.push("doc_type = @doc_type"), n.doc_type = e.doc_type ?? null), e.doc_series !== void 0 && (i.push("doc_series = @doc_series"), n.doc_series = e.doc_series ?? null), e.doc_number !== void 0 && (i.push("doc_number = @doc_number"), n.doc_number = e.doc_number ?? null), e.doc_issued_by !== void 0 && (i.push("doc_issued_by = @doc_issued_by"), n.doc_issued_by = e.doc_issued_by ?? null), a !== void 0 && (i.push("doc_issued_date = @doc_issued_date"), n.doc_issued_date = a), e.home_address !== void 0 && (i.push("home_address = @home_address"), n.home_address = e.home_address ?? null), e.workplace !== void 0 && (i.push("workplace = @workplace"), n.workplace = e.workplace ?? null), e.subscription_id !== void 0) {
      i.push("last_payment_date = @last_payment_date");
      const l = e.subscription_start_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      n.last_payment_date = l;
    }
    if (i.length === 0) return this.getById(s);
    if (i.push("updated_at = CURRENT_TIMESTAMP"), i.push("sync_status = 'pending'"), t.prepare(`UPDATE clients SET ${i.join(", ")} WHERE id = @id`).run(n), e.subscription_id !== void 0) {
      const l = e.subscription_start_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0], p = T.getClientSubscriptions(s), u = p.length > 0 ? p[0] : void 0;
      if (!u || u.subscription_id !== e.subscription_id)
        try {
          T.assignSubscription({
            client_id: s,
            subscription_id: e.subscription_id,
            start_date: l,
            is_paid: !0
          });
        } catch (E) {
          console.error("Error assigning subscription on client update:", E);
        }
    }
    return this.getById(s);
  },
  updatePaymentDate(s, e) {
    d().prepare(`
      UPDATE clients 
      SET last_payment_date = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 'pending'
      WHERE id = ?
    `).run(e, s);
  },
  delete(s) {
    return d().prepare("DELETE FROM clients WHERE id = ?").run(s).changes > 0;
  },
  addParent(s, e) {
    const t = d(), i = t.prepare(`
      INSERT INTO clients_parents (client_id, full_name, phone)
      VALUES (@client_id, @full_name, @phone)
    `).run({
      client_id: s,
      full_name: e.full_name,
      phone: e.phone ?? null
    });
    return t.prepare("SELECT * FROM clients_parents WHERE id = ?").get(i.lastInsertRowid);
  },
  removeParent(s) {
    return d().prepare("DELETE FROM clients_parents WHERE id = ?").run(s).changes > 0;
  }
}, b = {
  getAll() {
    return d().prepare(`
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
    const e = d(), t = e.prepare("SELECT * FROM groups WHERE id = ?").get(s);
    if (!t) return;
    const i = t.trainer_id ? e.prepare("SELECT * FROM employees WHERE id = ?").get(t.trainer_id) : void 0, n = e.prepare("SELECT * FROM group_schedule WHERE group_id = ? ORDER BY day_of_week").all(s), r = e.prepare(`
      SELECT gm.*, c.full_name, c.phone, c.birth_year
      FROM group_members gm
      JOIN clients c ON gm.client_id = c.id
      WHERE gm.group_id = ?
      ORDER BY c.full_name
    `).all(s);
    return {
      ...t,
      trainer: i,
      schedule: n,
      members: r.map((a) => ({
        ...a,
        client: {
          id: a.client_id,
          full_name: a.full_name,
          phone: a.phone,
          birth_year: a.birth_year
        }
      })),
      member_count: r.length
    };
  },
  getByTrainer(s) {
    return d().prepare("SELECT * FROM groups WHERE trainer_id = ?").all(s);
  },
  create(s) {
    const e = d(), i = e.transaction(() => {
      const a = e.prepare(`
        INSERT INTO groups (name, start_date, trainer_id)
        VALUES (@name, @start_date, @trainer_id)
      `).run({
        name: s.name,
        start_date: s.start_date ?? null,
        trainer_id: s.trainer_id ?? null
      }).lastInsertRowid;
      if (s.schedule && s.schedule.length > 0) {
        const c = e.prepare(`
          INSERT INTO group_schedule (group_id, day_of_week, start_time, end_time)
          VALUES (@group_id, @day_of_week, @start_time, @end_time)
        `);
        for (const l of s.schedule)
          c.run({
            group_id: a,
            day_of_week: l.day_of_week,
            start_time: l.start_time,
            end_time: l.end_time
          });
      }
      return a;
    })();
    return this.getById(i);
  },
  update(s, e) {
    const t = d(), i = [], n = { id: s };
    return e.name !== void 0 && (i.push("name = @name"), n.name = e.name), e.start_date !== void 0 && (i.push("start_date = @start_date"), n.start_date = e.start_date), e.trainer_id !== void 0 && (i.push("trainer_id = @trainer_id"), n.trainer_id = e.trainer_id), i.length === 0 ? this.getById(s) : (i.push("updated_at = CURRENT_TIMESTAMP"), i.push("sync_status = 'pending'"), t.prepare(`UPDATE groups SET ${i.join(", ")} WHERE id = @id`).run(n), this.getById(s));
  },
  delete(s) {
    return d().prepare("DELETE FROM groups WHERE id = ?").run(s).changes > 0;
  },
  addSchedule(s, e) {
    const t = d(), i = t.prepare(`
      INSERT INTO group_schedule (group_id, day_of_week, start_time, end_time)
      VALUES (@group_id, @day_of_week, @start_time, @end_time)
    `).run({
      group_id: s,
      ...e
    });
    return t.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(s), t.prepare("SELECT * FROM group_schedule WHERE id = ?").get(i.lastInsertRowid);
  },
  updateSchedule(s, e) {
    const t = d(), i = [], n = { id: s };
    e.day_of_week !== void 0 && (i.push("day_of_week = @day_of_week"), n.day_of_week = e.day_of_week), e.start_time !== void 0 && (i.push("start_time = @start_time"), n.start_time = e.start_time), e.end_time !== void 0 && (i.push("end_time = @end_time"), n.end_time = e.end_time), i.length > 0 && (i.push("sync_status = 'pending'"), t.prepare(`UPDATE group_schedule SET ${i.join(", ")} WHERE id = @id`).run(n));
  },
  removeSchedule(s) {
    return d().prepare("DELETE FROM group_schedule WHERE id = ?").run(s).changes > 0;
  },
  addMember(s, e) {
    const t = d();
    return t.transaction(() => {
      const r = t.prepare(`
        INSERT INTO group_members (group_id, client_id)
        VALUES (?, ?)
      `).run(s, e).lastInsertRowid, a = t.prepare("SELECT * FROM group_members WHERE id = ?").get(r), c = t.prepare(`
        SELECT id 
        FROM lessons 
        WHERE group_id = ? AND lesson_date >= ?
      `).all(s, a.joined_at), l = t.prepare(`
        INSERT OR IGNORE INTO attendance (lesson_id, client_id, status)
        VALUES (?, ?, NULL)
      `);
      for (const p of c)
        l.run(p.id, e);
      return t.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(s), a;
    })();
  },
  removeMember(s, e) {
    const t = d(), i = t.prepare("DELETE FROM group_members WHERE group_id = ? AND client_id = ?").run(s, e);
    return i.changes > 0 && t.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(s), i.changes > 0;
  },
  getScheduleForDay(s) {
    return d().prepare(`
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
    const e = d(), t = s?.page || 1, i = s?.limit || 30, n = (t - 1) * i;
    let r = "WHERE 1=1";
    const a = [];
    s?.groupId && (r += " AND l.group_id = ?", a.push(s.groupId)), s?.startDate && (r += " AND l.lesson_date >= ?", a.push(s.startDate)), s?.endDate && (r += " AND l.lesson_date <= ?", a.push(s.endDate));
    const c = `
      SELECT COUNT(*) as total
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      ${r}
    `, p = e.prepare(c).get(...a).total, u = `
      SELECT 
        l.*,
        g.name as group_name,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM attendance WHERE lesson_id = l.id AND status = 'present') as attendance_count,
        (SELECT COUNT(*) FROM group_members WHERE group_id = l.group_id) as total_members
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      ${r}
      ORDER BY l.lesson_date ASC, l.start_time ASC
      LIMIT ? OFFSET ?
    `;
    return { data: e.prepare(u).all(...a, i, n), total: p };
  },
  getById(s) {
    return d().prepare(`
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
    return d().prepare(`
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
    const e = d(), i = e.transaction(() => {
      const r = e.prepare(`
        INSERT INTO lessons (group_id, lesson_date, start_time, end_time)
        VALUES (@group_id, @lesson_date, @start_time, @end_time)
      `).run(s).lastInsertRowid, a = e.prepare("SELECT client_id FROM group_members WHERE group_id = ?").all(s.group_id), c = e.prepare(`
        INSERT INTO attendance (lesson_id, client_id, status)
        VALUES (?, ?, NULL)
      `);
      for (const l of a)
        c.run(r, l.client_id);
      return r;
    })();
    return e.prepare("SELECT * FROM lessons WHERE id = ?").get(i);
  },
  generateFromSchedule(s, e, t) {
    const i = d(), n = i.prepare("SELECT * FROM group_schedule WHERE group_id = ?").all(s);
    if (n.length === 0) return [];
    const r = [], a = new Date(e), c = new Date(t);
    for (let l = new Date(a); l <= c; l.setDate(l.getDate() + 1)) {
      const p = (l.getDay() + 6) % 7, u = n.find((E) => E.day_of_week === p);
      if (u) {
        const E = l.toISOString().split("T")[0];
        if (!i.prepare(`
          SELECT id FROM lessons WHERE group_id = ? AND lesson_date = ?
        `).get(s, E)) {
          const U = this.create({
            group_id: s,
            lesson_date: E,
            start_time: u.start_time,
            end_time: u.end_time
          });
          r.push(U);
        }
      }
    }
    return r;
  },
  delete(s) {
    return d().prepare("DELETE FROM lessons WHERE id = ?").run(s).changes > 0;
  },
  /**
   * Получить занятия группы за указанный месяц
   */
  getByGroupAndMonth(s, e, t) {
    const i = d(), n = `${e}-${String(t).padStart(2, "0")}-01`, r = new Date(e, t, 0).getDate(), a = `${e}-${String(t).padStart(2, "0")}-${String(r).padStart(2, "0")}`;
    return i.prepare(`
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
    `).all(s, n, a);
  },
  /**
   * Получить полную матрицу посещаемости группы за месяц
   * Возвращает: { lessons: [], members: [], attendance: { lessonId: { clientId: status } } }
   */
  getGroupAttendanceMatrix(s, e, t) {
    const i = d(), n = this.getByGroupAndMonth(s, e, t), r = i.prepare(`
      SELECT gm.client_id, c.full_name as client_name, c.phone as client_phone
      FROM group_members gm
      JOIN clients c ON c.id = gm.client_id
      WHERE gm.group_id = ?
      ORDER BY c.full_name
    `).all(s), a = n.map((u) => u.id);
    if (a.length === 0)
      return { lessons: n, members: r, attendance: {} };
    const c = a.map(() => "?").join(","), l = i.prepare(`
      SELECT lesson_id, client_id, status
      FROM attendance
      WHERE lesson_id IN (${c})
    `).all(...a), p = {};
    for (const u of l)
      p[u.lesson_id] || (p[u.lesson_id] = {}), p[u.lesson_id][u.client_id] = u.status;
    return { lessons: n, members: r, attendance: p };
  }
}, y = {
  getByLesson(s) {
    return d().prepare(`
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
    const i = d();
    return i.prepare(`
      INSERT INTO attendance (lesson_id, client_id, status, updated_at, sync_status)
      VALUES (@lesson_id, @client_id, @status, CURRENT_TIMESTAMP, 'pending')
      ON CONFLICT(lesson_id, client_id) DO UPDATE SET
        status = @status,
        updated_at = CURRENT_TIMESTAMP,
        sync_status = 'pending'
    `).run({ lesson_id: s, client_id: e, status: t }), i.prepare("SELECT * FROM attendance WHERE lesson_id = ? AND client_id = ?").get(s, e);
  },
  getClientAttendance(s, e, t) {
    const i = d();
    let n = `
      SELECT a.*, l.lesson_date, l.start_time, l.end_time, g.name as group_name
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN groups g ON l.group_id = g.id
      WHERE a.client_id = ?
    `;
    const r = [s];
    return e && (n += " AND l.lesson_date >= ?", r.push(e)), t && (n += " AND l.lesson_date <= ?", r.push(t)), n += " ORDER BY l.lesson_date DESC", i.prepare(n).all(...r);
  },
  getStatsByGroup(s) {
    return d().prepare(`
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
let _ = null;
function G() {
  o.handle("db:employees:getAll", () => S.getAll()), o.handle("db:employees:getById", (s, e) => S.getById(e)), o.handle("db:employees:create", (s, e) => S.create(e)), o.handle("db:employees:update", (s, e, t) => S.update(e, t)), o.handle("db:employees:delete", (s, e) => S.delete(e)), o.handle("auth:login", (s, e, t) => S.authenticate(e, t)), o.handle("db:clients:getAll", (s, e) => m.getAll(e)), o.handle("db:clients:getById", (s, e) => m.getById(e)), o.handle("db:clients:search", (s, e, t) => m.search(e, t)), o.handle("db:clients:getDebtors", (s, e) => m.getDebtors(e)), o.handle("db:clients:create", (s, e) => m.create(e)), o.handle("db:clients:update", (s, e, t) => m.update(e, t)), o.handle("db:clients:updatePaymentDate", (s, e, t) => m.updatePaymentDate(e, t)), o.handle("db:clients:delete", (s, e) => m.delete(e)), o.handle("db:clients:addParent", (s, e, t) => m.addParent(e, t)), o.handle("db:clients:removeParent", (s, e) => m.removeParent(e)), o.handle("db:subscriptions:getAll", () => T.getAll()), o.handle("db:subscriptions:getActive", () => T.getActive()), o.handle("db:subscriptions:getById", (s, e) => T.getById(e)), o.handle("db:subscriptions:create", (s, e) => T.create(e)), o.handle("db:subscriptions:update", (s, e, t) => T.update(e, t)), o.handle("db:subscriptions:delete", (s, e) => T.delete(e)), o.handle("db:subscriptions:getClientSubscriptions", (s, e) => T.getClientSubscriptions(e)), o.handle("db:subscriptions:getActiveClientSubscription", (s, e) => T.getActiveClientSubscription(e)), o.handle("db:subscriptions:assign", (s, e) => T.assignSubscription(e)), o.handle("db:subscriptions:markAsPaid", (s, e, t) => T.markAsPaid(e, t)), o.handle("db:subscriptions:incrementVisit", (s, e) => T.incrementVisit(e)), o.handle("db:subscriptions:removeClientSubscription", (s, e) => T.removeClientSubscription(e)), o.handle("db:subscriptions:getUnpaid", () => T.getUnpaidSubscriptions()), o.handle("db:subscriptions:getExpiring", (s, e) => T.getExpiringSubscriptions(e)), o.handle("db:groups:getAll", () => b.getAll()), o.handle("db:groups:getById", (s, e) => b.getById(e)), o.handle("db:groups:create", (s, e) => b.create(e)), o.handle("db:groups:update", (s, e, t) => b.update(e, t)), o.handle("db:groups:delete", (s, e) => b.delete(e)), o.handle("db:groups:addSchedule", (s, e, t) => b.addSchedule(e, t)), o.handle("db:groups:updateSchedule", (s, e, t) => b.updateSchedule(e, t)), o.handle("db:groups:removeSchedule", (s, e) => b.removeSchedule(e)), o.handle("db:groups:addMember", (s, e, t) => b.addMember(e, t)), o.handle("db:groups:removeMember", (s, e, t) => b.removeMember(e, t)), o.handle("db:groups:getScheduleForDay", (s, e) => b.getScheduleForDay(e)), o.handle("db:lessons:getAll", (s, e) => N.getAll(e)), o.handle("db:lessons:getById", (s, e) => N.getById(e)), o.handle("db:lessons:getByDate", (s, e) => N.getByDate(e)), o.handle("db:lessons:getTodayLessons", () => N.getTodayLessons()), o.handle("db:lessons:create", (s, e) => N.create(e)), o.handle("db:lessons:generateFromSchedule", (s, e, t, i) => N.generateFromSchedule(e, t, i)), o.handle("db:lessons:delete", (s, e) => N.delete(e)), o.handle("db:lessons:getByGroupAndMonth", (s, e, t, i) => N.getByGroupAndMonth(e, t, i)), o.handle("db:lessons:getGroupAttendanceMatrix", (s, e, t, i) => N.getGroupAttendanceMatrix(e, t, i)), o.handle("db:attendance:getByLesson", (s, e) => y.getByLesson(e)), o.handle("db:attendance:updateStatus", (s, e, t, i) => y.updateStatus(e, t, i)), o.handle("db:attendance:getClientAttendance", (s, e, t, i) => y.getClientAttendance(e, t, i)), o.handle("db:attendance:getStatsByGroup", (s, e) => y.getStatsByGroup(e)), o.handle("sync:start", () => Promise.resolve()), o.handle("sync:status", () => Promise.resolve("idle"));
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
      const t = h.join(C, "preload.js"), i = h.resolve(process.cwd(), "dist-electron", "preload.js");
      A(t) ? (s = t, console.log(`Using .js preload path: ${s}`)) : A(i) ? (s = i, console.log(`Using alternative .js preload path: ${s}`)) : (console.error(`Preload script not found at: ${s}`), console.error("Alternative paths also not found"), console.error(`__dirname: ${C}`), console.error(`process.cwd(): ${process.cwd()}`));
    }
  }
  if (_ = new v({
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
  }), _.webContents.openDevTools(), _.once("ready-to-show", () => {
    console.log("Window ready to show"), _ && (_.show(), _.focus(), _.moveTop());
  }), _.on("closed", () => {
    _ = null;
  }), _.webContents.on("did-fail-load", (e, t, i, n) => {
    console.error("Failed to load:", t, i, n), _ && _.show();
  }), _.webContents.on("did-finish-load", () => {
    console.log("Page finished loading"), _ && !_.isVisible() && (_.show(), _.focus());
  }), process.env.VITE_DEV_SERVER_URL)
    console.log("Loading dev server:", process.env.VITE_DEV_SERVER_URL), _.loadURL(process.env.VITE_DEV_SERVER_URL);
  else {
    const e = O.getAppPath(), t = h.join(e, "dist", "index.html");
    if (console.log("App path:", e), console.log("Loading file:", t), console.log("File exists:", A(t)), A(t))
      _.loadFile(t).catch((i) => {
        console.error("Error loading file:", i), _ && _.show();
      });
    else {
      const i = h.join(C, "../dist/index.html");
      console.log("Trying alternative path:", i), console.log("Alternative exists:", A(i)), A(i) ? _.loadFile(i).catch((n) => {
        console.error("Error loading alternative file:", n), _ && _.show();
      }) : (console.error("index.html not found in both paths"), _ && _.show());
    }
  }
  setTimeout(() => {
    _ && (console.log("Force showing window after timeout"), _.isVisible() || _.show(), _.focus(), _.moveTop(), _.setAlwaysOnTop(!0), setTimeout(() => {
      _ && _.setAlwaysOnTop(!1);
    }, 1e3));
  }, 2e3);
}
O.whenReady().then(() => {
  x(), G(), H();
});
O.on("window-all-closed", () => {
  process.platform !== "darwin" && (w(), O.quit());
});
O.on("activate", () => {
  v.getAllWindows().length === 0 && H();
});
O.on("before-quit", () => {
  w();
});
