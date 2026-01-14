# Этап 1: База данных и Backend

**Срок:** 1-2 дня

## Задачи

- [x] Создать миграцию version 3
- [x] Создать файл `subscriptions.ts` с queries
- [x] Добавить IPC handlers в `main.ts`
- [x] Протестировать создание/редактирование абонементов

---

## 1.1 Миграция базы данных (version 3)

**Файл:** `electron/database/migrations.ts`

Добавить новую миграцию для создания таблиц абонементов:

```typescript
{
  version: 3,
  name: 'add_subscriptions',
  up: (db: Database.Database) => {
    // Создание таблицы абонементов
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

    // Создание абонемента "Все включено"
    const result = db.prepare(`
      INSERT INTO subscriptions (name, price, duration_days, visit_limit)
      VALUES ('Все включено', 3500, 30, 0)
    `).run()
    
    const subscriptionId = result.lastInsertRowid

    // Добавление абонемента всем существующим клиентам
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
```

---

## 1.2 Queries для абонементов

**Новый файл:** `electron/database/queries/subscriptions.ts`

```typescript
import { getDatabase } from '../index'

export interface Subscription {
  id: number
  name: string
  price: number
  duration_days: number
  visit_limit: number
  is_active: number
  created_at: string
  updated_at: string
  sync_status: string
}

export interface ClientSubscription {
  id: number
  client_id: number
  subscription_id: number
  subscription_name?: string
  subscription_price?: number
  start_date: string
  end_date: string
  visits_used: number
  visits_total: number
  is_paid: number
  payment_date: string | null
  created_at: string
  updated_at: string
}

export interface CreateSubscriptionDto {
  name: string
  price: number
  duration_days: number
  visit_limit?: number
}

export interface UpdateSubscriptionDto {
  name?: string
  price?: number
  duration_days?: number
  visit_limit?: number
  is_active?: number
}

export interface AssignSubscriptionDto {
  client_id: number
  subscription_id: number
  start_date: string
  is_paid?: boolean
}

export const subscriptionQueries = {
  // === Абонементы ===
  
  getAll(): Subscription[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT * FROM subscriptions 
      ORDER BY name
    `).all() as Subscription[]
  },

  getActive(): Subscription[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT * FROM subscriptions 
      WHERE is_active = 1
      ORDER BY name
    `).all() as Subscription[]
  },

  getById(id: number): Subscription | undefined {
    const db = getDatabase()
    return db.prepare('SELECT * FROM subscriptions WHERE id = ?').get(id) as Subscription | undefined
  },

  create(data: CreateSubscriptionDto): Subscription {
    const db = getDatabase()
    const result = db.prepare(`
      INSERT INTO subscriptions (name, price, duration_days, visit_limit)
      VALUES (@name, @price, @duration_days, @visit_limit)
    `).run({
      name: data.name,
      price: data.price,
      duration_days: data.duration_days,
      visit_limit: data.visit_limit ?? 0
    })
    
    return this.getById(result.lastInsertRowid as number)!
  },

  update(id: number, data: UpdateSubscriptionDto): Subscription | undefined {
    const db = getDatabase()
    const fields: string[] = []
    const values: Record<string, unknown> = { id }

    if (data.name !== undefined) {
      fields.push('name = @name')
      values.name = data.name
    }
    if (data.price !== undefined) {
      fields.push('price = @price')
      values.price = data.price
    }
    if (data.duration_days !== undefined) {
      fields.push('duration_days = @duration_days')
      values.duration_days = data.duration_days
    }
    if (data.visit_limit !== undefined) {
      fields.push('visit_limit = @visit_limit')
      values.visit_limit = data.visit_limit
    }
    if (data.is_active !== undefined) {
      fields.push('is_active = @is_active')
      values.is_active = data.is_active
    }

    if (fields.length === 0) return this.getById(id)

    fields.push("updated_at = CURRENT_TIMESTAMP")
    fields.push("sync_status = 'pending'")

    db.prepare(`UPDATE subscriptions SET ${fields.join(', ')} WHERE id = @id`).run(values)
    return this.getById(id)
  },

  delete(id: number): boolean {
    const db = getDatabase()
    // Проверяем, есть ли активные подписки клиентов
    const activeCount = db.prepare(`
      SELECT COUNT(*) as count FROM client_subscriptions 
      WHERE subscription_id = ? AND end_date >= date('now')
    `).get(id) as { count: number }
    
    if (activeCount.count > 0) {
      throw new Error('Невозможно удалить абонемент: есть активные подписки клиентов')
    }
    
    const result = db.prepare('DELETE FROM subscriptions WHERE id = ?').run(id)
    return result.changes > 0
  },

  // === Абонементы клиентов ===

  getClientSubscriptions(clientId: number): ClientSubscription[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      WHERE cs.client_id = ?
      ORDER BY cs.start_date DESC
    `).all(clientId) as ClientSubscription[]
  },

  getActiveClientSubscription(clientId: number): ClientSubscription | undefined {
    const db = getDatabase()
    return db.prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      WHERE cs.client_id = ?
        AND cs.end_date >= date('now')
        AND cs.start_date <= date('now')
        AND (cs.visits_total = 0 OR cs.visits_used < cs.visits_total)
      ORDER BY cs.end_date ASC
      LIMIT 1
    `).get(clientId) as ClientSubscription | undefined
  },

  assignSubscription(data: AssignSubscriptionDto): ClientSubscription {
    const db = getDatabase()
    
    const subscription = this.getById(data.subscription_id)
    if (!subscription) {
      throw new Error('Абонемент не найден')
    }

    const startDate = new Date(data.start_date)
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + subscription.duration_days)

    const result = db.prepare(`
      INSERT INTO client_subscriptions 
      (client_id, subscription_id, start_date, end_date, visits_total, is_paid, payment_date)
      VALUES (@client_id, @subscription_id, @start_date, @end_date, @visits_total, @is_paid, @payment_date)
    `).run({
      client_id: data.client_id,
      subscription_id: data.subscription_id,
      start_date: data.start_date,
      end_date: endDate.toISOString().split('T')[0],
      visits_total: subscription.visit_limit,
      is_paid: data.is_paid ? 1 : 0,
      payment_date: data.is_paid ? data.start_date : null
    })

    return db.prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      WHERE cs.id = ?
    `).get(result.lastInsertRowid) as ClientSubscription
  },

  markAsPaid(clientSubscriptionId: number, paymentDate?: string): ClientSubscription | undefined {
    const db = getDatabase()
    const date = paymentDate || new Date().toISOString().split('T')[0]
    
    db.prepare(`
      UPDATE client_subscriptions 
      SET is_paid = 1, payment_date = ?, updated_at = CURRENT_TIMESTAMP, sync_status = 'pending'
      WHERE id = ?
    `).run(date, clientSubscriptionId)

    return db.prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      WHERE cs.id = ?
    `).get(clientSubscriptionId) as ClientSubscription | undefined
  },

  incrementVisit(clientSubscriptionId: number): boolean {
    const db = getDatabase()
    const result = db.prepare(`
      UPDATE client_subscriptions 
      SET visits_used = visits_used + 1, updated_at = CURRENT_TIMESTAMP, sync_status = 'pending'
      WHERE id = ? AND (visits_total = 0 OR visits_used < visits_total)
    `).run(clientSubscriptionId)
    
    return result.changes > 0
  },

  removeClientSubscription(clientSubscriptionId: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM client_subscriptions WHERE id = ?').run(clientSubscriptionId)
    return result.changes > 0
  },

  // === Статистика и отчёты ===

  getUnpaidSubscriptions(): (ClientSubscription & { client_name: string })[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price, c.full_name as client_name
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      JOIN clients c ON c.id = cs.client_id
      WHERE cs.is_paid = 0 AND cs.end_date >= date('now')
      ORDER BY cs.start_date ASC
    `).all() as (ClientSubscription & { client_name: string })[]
  },

  getExpiringSubscriptions(daysAhead: number = 7): (ClientSubscription & { client_name: string })[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT cs.*, s.name as subscription_name, s.price as subscription_price, c.full_name as client_name
      FROM client_subscriptions cs
      JOIN subscriptions s ON s.id = cs.subscription_id
      JOIN clients c ON c.id = cs.client_id
      WHERE cs.end_date BETWEEN date('now') AND date('now', '+' || ? || ' days')
        AND (cs.visits_total = 0 OR cs.visits_used < cs.visits_total)
      ORDER BY cs.end_date ASC
    `).all(daysAhead) as (ClientSubscription & { client_name: string })[]
  }
}
```

---

## 1.3 IPC Handlers

**Обновить файл:** `electron/main.ts`

```typescript
// Добавить импорт
import { subscriptionQueries } from './database/queries/subscriptions'

// Добавить в функцию setupIpcHandlers():

// Subscriptions
ipcMain.handle('db:subscriptions:getAll', () => subscriptionQueries.getAll())
ipcMain.handle('db:subscriptions:getActive', () => subscriptionQueries.getActive())
ipcMain.handle('db:subscriptions:getById', (_, id) => subscriptionQueries.getById(id))
ipcMain.handle('db:subscriptions:create', (_, data) => subscriptionQueries.create(data))
ipcMain.handle('db:subscriptions:update', (_, id, data) => subscriptionQueries.update(id, data))
ipcMain.handle('db:subscriptions:delete', (_, id) => subscriptionQueries.delete(id))

// Client Subscriptions
ipcMain.handle('db:subscriptions:getClientSubscriptions', (_, clientId) => 
  subscriptionQueries.getClientSubscriptions(clientId))
ipcMain.handle('db:subscriptions:getActiveClientSubscription', (_, clientId) => 
  subscriptionQueries.getActiveClientSubscription(clientId))
ipcMain.handle('db:subscriptions:assign', (_, data) => subscriptionQueries.assignSubscription(data))
ipcMain.handle('db:subscriptions:markAsPaid', (_, id, date) => subscriptionQueries.markAsPaid(id, date))
ipcMain.handle('db:subscriptions:incrementVisit', (_, id) => subscriptionQueries.incrementVisit(id))
ipcMain.handle('db:subscriptions:removeClientSubscription', (_, id) => 
  subscriptionQueries.removeClientSubscription(id))
ipcMain.handle('db:subscriptions:getUnpaid', () => subscriptionQueries.getUnpaidSubscriptions())
ipcMain.handle('db:subscriptions:getExpiring', (_, days) => subscriptionQueries.getExpiringSubscriptions(days))
```

---

## ✅ Критерии готовности этапа

1. Таблицы `subscriptions` и `client_subscriptions` созданы в БД
2. Абонемент "Все включено" создан автоматически при миграции
3. Все существующие клиенты получили абонемент
4. Все IPC handlers работают и доступны из рендерера
5. CRUD операции с абонементами протестированы

