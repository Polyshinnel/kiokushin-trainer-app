# План разработки функционала абонементов

## Обзор

Данный документ описывает детальный план технической реализации системы абонементов для приложения Kentos Dojo.

---

## 📋 Содержание

1. [Структура базы данных](#1-структура-базы-данных)
2. [Backend (Electron)](#2-backend-electron)
3. [Frontend компоненты](#3-frontend-компоненты)
4. [Интеграция с клиентами](#4-интеграция-с-клиентами)
5. [Система учёта оплаты](#5-система-учёта-оплаты)
6. [Этапы реализации](#6-этапы-реализации)

---

## 1. Структура базы данных

### 1.1 Таблица абонементов (`subscriptions`)

```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,                    -- Название абонемента
  price REAL NOT NULL,                   -- Цена абонемента
  duration_days INTEGER NOT NULL,        -- Срок действия в днях
  visit_limit INTEGER DEFAULT 0,         -- Количество посещений (0 = безлимит)
  is_active INTEGER DEFAULT 1,           -- Активен ли абонемент для продажи
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT DEFAULT 'pending'
);
```

### 1.2 Таблица абонементов клиентов (`client_subscriptions`)

```sql
CREATE TABLE IF NOT EXISTS client_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  subscription_id INTEGER NOT NULL,
  start_date DATE NOT NULL,              -- Дата начала действия
  end_date DATE NOT NULL,                -- Дата окончания действия
  visits_used INTEGER DEFAULT 0,         -- Использовано посещений
  visits_total INTEGER DEFAULT 0,        -- Всего доступно посещений (0 = безлимит)
  is_paid INTEGER DEFAULT 0,             -- Оплачен ли абонемент
  payment_date DATE,                     -- Дата оплаты
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT DEFAULT 'pending',
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE RESTRICT
);

-- Индексы для оптимизации запросов
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_client ON client_subscriptions(client_id);
CREATE INDEX IF NOT EXISTS idx_client_subscriptions_dates ON client_subscriptions(start_date, end_date);
```

### 1.3 Миграция версии 3: Добавление таблиц абонементов

**Файл:** `electron/database/migrations.ts`

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

## 2. Backend (Electron)

### 2.1 Queries для абонементов

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

### 2.2 IPC Handlers

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

## 3. Frontend компоненты

### 3.1 Типы TypeScript

**Обновить файл:** `src/types/index.ts`

```typescript
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
  client_name?: string
  created_at: string
  updated_at: string
}
```

### 3.2 API функции

**Обновить файл:** `src/lib/api.ts`

```typescript
export const subscriptionsApi = {
  getAll: () => window.electronAPI.db.query('subscriptions:getAll'),
  getActive: () => window.electronAPI.db.query('subscriptions:getActive'),
  getById: (id: number) => window.electronAPI.db.query('subscriptions:getById', id),
  create: (data: any) => window.electronAPI.db.query('subscriptions:create', data),
  update: (id: number, data: any) => window.electronAPI.db.query('subscriptions:update', id, data),
  delete: (id: number) => window.electronAPI.db.query('subscriptions:delete', id),
  
  // Client subscriptions
  getClientSubscriptions: (clientId: number) => 
    window.electronAPI.db.query('subscriptions:getClientSubscriptions', clientId),
  getActiveClientSubscription: (clientId: number) => 
    window.electronAPI.db.query('subscriptions:getActiveClientSubscription', clientId),
  assign: (data: any) => window.electronAPI.db.query('subscriptions:assign', data),
  markAsPaid: (id: number, date?: string) => 
    window.electronAPI.db.query('subscriptions:markAsPaid', id, date),
  incrementVisit: (id: number) => window.electronAPI.db.query('subscriptions:incrementVisit', id),
  removeClientSubscription: (id: number) => 
    window.electronAPI.db.query('subscriptions:removeClientSubscription', id),
  getUnpaid: () => window.electronAPI.db.query('subscriptions:getUnpaid'),
  getExpiring: (days?: number) => window.electronAPI.db.query('subscriptions:getExpiring', days)
}
```

### 3.3 Zustand Store

**Новый файл:** `src/stores/subscriptionsStore.ts`

```typescript
import { create } from 'zustand'
import { subscriptionsApi } from '@/lib/api'
import type { Subscription, ClientSubscription } from '@/types'

interface SubscriptionsState {
  subscriptions: Subscription[]
  isLoading: boolean
  
  fetchSubscriptions: () => Promise<void>
  createSubscription: (data: any) => Promise<Subscription>
  updateSubscription: (id: number, data: any) => Promise<Subscription>
  deleteSubscription: (id: number) => Promise<boolean>
}

export const useSubscriptionsStore = create<SubscriptionsState>((set, get) => ({
  subscriptions: [],
  isLoading: false,

  fetchSubscriptions: async () => {
    set({ isLoading: true })
    try {
      const subscriptions = await subscriptionsApi.getAll() as Subscription[]
      set({ subscriptions, isLoading: false })
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
      set({ isLoading: false })
    }
  },

  createSubscription: async (data) => {
    const subscription = await subscriptionsApi.create(data) as Subscription
    set((state) => ({ subscriptions: [...state.subscriptions, subscription] }))
    return subscription
  },

  updateSubscription: async (id, data) => {
    const subscription = await subscriptionsApi.update(id, data) as Subscription
    set((state) => ({
      subscriptions: state.subscriptions.map((s) => (s.id === id ? subscription : s))
    }))
    return subscription
  },

  deleteSubscription: async (id) => {
    const success = await subscriptionsApi.delete(id) as boolean
    if (success) {
      set((state) => ({
        subscriptions: state.subscriptions.filter((s) => s.id !== id)
      }))
    }
    return success
  }
}))
```

### 3.4 Структура файлов компонентов

```
src/
├── components/
│   └── subscriptions/
│       ├── SubscriptionsTable.tsx      # Таблица абонементов
│       ├── SubscriptionForm.tsx        # Форма создания/редактирования
│       ├── AssignSubscriptionDialog.tsx # Диалог назначения абонемента клиенту
│       └── ClientSubscriptionCard.tsx   # Карточка абонемента клиента
├── pages/
│   └── Subscriptions.tsx               # Страница списка абонементов
```

### 3.5 Страница списка абонементов

**Новый файл:** `src/pages/Subscriptions.tsx`

```tsx
import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useSubscriptionsStore } from '@/stores/subscriptionsStore'
import { SubscriptionsTable } from '@/components/subscriptions/SubscriptionsTable'
import { SubscriptionForm } from '@/components/subscriptions/SubscriptionForm'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { toast } from 'sonner'
import type { Subscription } from '@/types'

export function Subscriptions() {
  const { subscriptions, isLoading, fetchSubscriptions, createSubscription, updateSubscription, deleteSubscription } = useSubscriptionsStore()
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null)
  const [deletingSubscription, setDeletingSubscription] = useState<Subscription | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  const handleCreate = () => {
    setEditingSubscription(null)
    setIsFormOpen(true)
  }

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription)
    setIsFormOpen(true)
  }

  const handleSubmit = async (data: any) => {
    try {
      if (editingSubscription) {
        await updateSubscription(editingSubscription.id, data)
        toast.success('Абонемент обновлён')
      } else {
        await createSubscription(data)
        toast.success('Абонемент создан')
      }
      setIsFormOpen(false)
    } catch (error) {
      toast.error('Ошибка сохранения')
    }
  }

  const handleDelete = async () => {
    if (!deletingSubscription) return
    setIsDeleting(true)
    try {
      await deleteSubscription(deletingSubscription.id)
      toast.success('Абонемент удалён')
      setDeletingSubscription(null)
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Абонементы" subtitle={`Всего: ${subscriptions.length}`} />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex justify-end">
            <Button 
              onClick={handleCreate}
              style={{ backgroundColor: '#0c194b', color: '#fff' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </div>
          
          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">Загрузка...</div>
            ) : (
              <SubscriptionsTable
                subscriptions={subscriptions}
                onEdit={handleEdit}
                onDelete={setDeletingSubscription}
              />
            )}
          </div>
        </div>
      </div>

      <SubscriptionForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        subscription={editingSubscription}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmDialog
        open={!!deletingSubscription}
        onOpenChange={(open) => !open && setDeletingSubscription(null)}
        title="Удалить абонемент?"
        description={`Вы уверены, что хотите удалить "${deletingSubscription?.name}"?`}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
}
```

### 3.6 Таблица абонементов

**Новый файл:** `src/components/subscriptions/SubscriptionsTable.tsx`

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2 } from 'lucide-react'
import type { Subscription } from '@/types'

interface SubscriptionsTableProps {
  subscriptions: Subscription[]
  onEdit: (subscription: Subscription) => void
  onDelete: (subscription: Subscription) => void
}

export function SubscriptionsTable({ subscriptions, onEdit, onDelete }: SubscriptionsTableProps) {
  const formatPrice = (price: number) => `${price.toLocaleString()} ₽`
  const formatDuration = (days: number) => {
    if (days === 30) return '1 месяц'
    if (days === 90) return '3 месяца'
    if (days === 180) return '6 месяцев'
    if (days === 365) return '1 год'
    return `${days} дн.`
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Название</TableHead>
          <TableHead>Цена</TableHead>
          <TableHead>Срок действия</TableHead>
          <TableHead>Посещений</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead className="w-[100px]">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-slate-500">
              Нет абонементов
            </TableCell>
          </TableRow>
        ) : (
          subscriptions.map((subscription) => (
            <TableRow key={subscription.id}>
              <TableCell className="font-medium">{subscription.name}</TableCell>
              <TableCell>{formatPrice(subscription.price)}</TableCell>
              <TableCell>{formatDuration(subscription.duration_days)}</TableCell>
              <TableCell>
                {subscription.visit_limit === 0 ? 'Безлимит' : subscription.visit_limit}
              </TableCell>
              <TableCell>
                <Badge variant={subscription.is_active ? 'default' : 'secondary'}>
                  {subscription.is_active ? 'Активен' : 'Неактивен'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(subscription)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => onDelete(subscription)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
```

### 3.7 Форма создания/редактирования абонемента

**Новый файл:** `src/components/subscriptions/SubscriptionForm.tsx`

```tsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Subscription } from '@/types'

interface SubscriptionFormData {
  name: string
  price: string
  duration_days: string
  visit_limit: string
}

interface SubscriptionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription?: Subscription | null
  onSubmit: (data: any) => Promise<void>
}

export function SubscriptionForm({ open, onOpenChange, subscription, onSubmit }: SubscriptionFormProps) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SubscriptionFormData>()

  useEffect(() => {
    if (open && subscription) {
      reset({
        name: subscription.name,
        price: subscription.price.toString(),
        duration_days: subscription.duration_days.toString(),
        visit_limit: subscription.visit_limit.toString()
      })
    } else if (open) {
      reset({ name: '', price: '', duration_days: '30', visit_limit: '0' })
    }
  }, [open, subscription, reset])

  const handleFormSubmit = async (data: SubscriptionFormData) => {
    await onSubmit({
      name: data.name,
      price: parseFloat(data.price),
      duration_days: parseInt(data.duration_days),
      visit_limit: parseInt(data.visit_limit) || 0
    })
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            {subscription ? 'Редактировать абонемент' : 'Создать абонемент'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название *</Label>
            <Input
              id="name"
              {...register('name', { required: 'Название обязательно' })}
              placeholder="Стандартный"
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Цена (₽) *</Label>
              <Input
                id="price"
                type="number"
                {...register('price', { required: 'Цена обязательна', min: 0 })}
                placeholder="3500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration_days">Срок (дней) *</Label>
              <Input
                id="duration_days"
                type="number"
                {...register('duration_days', { required: true, min: 1 })}
                placeholder="30"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit_limit">Количество посещений</Label>
            <Input
              id="visit_limit"
              type="number"
              {...register('visit_limit')}
              placeholder="0 = безлимит"
            />
            <p className="text-xs text-slate-500">0 — неограниченное количество посещений</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              style={{ backgroundColor: '#0c194b', color: '#fff' }}
            >
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 4. Интеграция с клиентами

### 4.1 Обновление формы клиента

**Обновить файл:** `src/components/clients/ClientForm.tsx`

Добавить выбор абонемента:

```tsx
// Добавить импорты
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { subscriptionsApi } from '@/lib/api'
import type { Subscription } from '@/types'

// Добавить в форму состояние
const [subscriptions, setSubscriptions] = useState<Subscription[]>([])

useEffect(() => {
  subscriptionsApi.getActive().then(setSubscriptions)
}, [])

// Добавить в JSX после родителей
<div className="space-y-2">
  <Label>Абонемент</Label>
  <Select 
    value={selectedSubscription?.toString() || ''} 
    onValueChange={(v) => setSelectedSubscription(parseInt(v))}
  >
    <SelectTrigger>
      <SelectValue placeholder="Выберите абонемент" />
    </SelectTrigger>
    <SelectContent>
      {subscriptions.map((sub) => (
        <SelectItem key={sub.id} value={sub.id.toString()}>
          {sub.name} — {sub.price.toLocaleString()} ₽
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

### 4.2 Компонент карточки абонемента клиента

**Новый файл:** `src/components/subscriptions/ClientSubscriptionCard.tsx`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreditCard, Calendar, CheckCircle, AlertCircle } from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ClientSubscription } from '@/types'

interface ClientSubscriptionCardProps {
  subscription: ClientSubscription
  onMarkPaid?: (id: number) => void
}

export function ClientSubscriptionCard({ subscription, onMarkPaid }: ClientSubscriptionCardProps) {
  const endDate = parseISO(subscription.end_date)
  const daysLeft = differenceInDays(endDate, new Date())
  const isExpired = daysLeft < 0
  const isExpiringSoon = daysLeft >= 0 && daysLeft <= 7

  const visitsInfo = subscription.visits_total === 0 
    ? 'Безлимит'
    : `${subscription.visits_used} / ${subscription.visits_total}`

  return (
    <Card className={isExpired ? 'border-red-200 bg-red-50' : isExpiringSoon ? 'border-yellow-200 bg-yellow-50' : ''}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{subscription.subscription_name}</CardTitle>
          <Badge variant={subscription.is_paid ? 'default' : 'destructive'}>
            {subscription.is_paid ? 'Оплачен' : 'Не оплачен'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Calendar className="w-4 h-4" />
          <span>
            {format(parseISO(subscription.start_date), 'dd.MM.yyyy', { locale: ru })} — 
            {format(endDate, 'dd.MM.yyyy', { locale: ru })}
          </span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CheckCircle className="w-4 h-4" />
          <span>Посещений: {visitsInfo}</span>
        </div>

        {isExpired && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span>Абонемент истёк</span>
          </div>
        )}

        {isExpiringSoon && !isExpired && (
          <div className="flex items-center gap-2 text-sm text-yellow-600">
            <AlertCircle className="w-4 h-4" />
            <span>Осталось {daysLeft} дн.</span>
          </div>
        )}

        {!subscription.is_paid && onMarkPaid && (
          <Button 
            size="sm" 
            onClick={() => onMarkPaid(subscription.id)}
            style={{ backgroundColor: '#0c194b', color: '#fff' }}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Отметить оплату
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 5. Система учёта оплаты

### 5.1 Логика проверки оплаты посещения

При отметке посещения проверять:

1. Есть ли у клиента активный абонемент
2. Оплачен ли абонемент
3. Не истёк ли абонемент
4. Остались ли посещения (если лимит > 0)

**Обновить файл:** `src/components/lessons/AttendanceDialog.tsx`

```tsx
// Добавить проверку при изменении статуса на "present"
const handleStatusChange = async (clientId: number, status: AttendanceStatus) => {
  if (status === 'present') {
    // Получить активный абонемент клиента
    const activeSubscription = await subscriptionsApi.getActiveClientSubscription(clientId)
    
    if (!activeSubscription) {
      toast.warning(`У клиента нет активного абонемента`)
    } else if (!activeSubscription.is_paid) {
      toast.warning(`Абонемент не оплачен`)
    } else {
      // Увеличить счётчик посещений
      await subscriptionsApi.incrementVisit(activeSubscription.id)
    }
  }
  
  await updateAttendance(lesson.id, clientId, status)
}
```

### 5.2 Индикация статуса оплаты

В списке посещаемости показывать:
- 🟢 Зелёный — абонемент оплачен и действует
- 🟡 Жёлтый — абонемент действует, но не оплачен
- 🔴 Красный — нет действующего абонемента

---

## 6. Этапы реализации

### Этап 1: База данных и Backend (1-2 дня)

- [ ] Создать миграцию version 3
- [ ] Создать файл `subscriptions.ts` с queries
- [ ] Добавить IPC handlers в `main.ts`
- [ ] Протестировать создание/редактирование абонементов

### Этап 2: Frontend — Страница абонементов (1 день)

- [ ] Создать типы в `types/index.ts`
- [ ] Создать `subscriptionsApi` в `api.ts`
- [ ] Создать `subscriptionsStore.ts`
- [ ] Создать страницу `Subscriptions.tsx`
- [ ] Создать компоненты:
  - [ ] `SubscriptionsTable.tsx`
  - [ ] `SubscriptionForm.tsx`
- [ ] Добавить роут в App.tsx
- [ ] Добавить пункт меню в Sidebar

### Этап 3: Интеграция с клиентами (1 день)

- [ ] Обновить `ClientForm.tsx` — добавить выбор абонемента
- [ ] Создать `AssignSubscriptionDialog.tsx`
- [ ] Создать `ClientSubscriptionCard.tsx`
- [ ] Показывать абонементы на странице клиента `ClientDetail.tsx`

### Этап 4: Учёт посещений и оплаты (1 день)

- [ ] Обновить `AttendanceDialog.tsx` — проверка оплаты
- [ ] Добавить индикаторы статуса оплаты
- [ ] Добавить уведомления об истекающих абонементах

### Этап 5: Дополнительные функции (1 день)

- [ ] Виджет на Dashboard — неоплаченные абонементы
- [ ] Виджет — истекающие абонементы
- [ ] Фильтрация клиентов по статусу абонемента

---

## 📁 Итоговая структура новых файлов

```
electron/database/
├── migrations.ts                    # Обновить: добавить version 3
└── queries/
    └── subscriptions.ts             # НОВЫЙ

src/
├── components/
│   └── subscriptions/
│       ├── SubscriptionsTable.tsx   # НОВЫЙ
│       ├── SubscriptionForm.tsx     # НОВЫЙ
│       ├── AssignSubscriptionDialog.tsx # НОВЫЙ
│       └── ClientSubscriptionCard.tsx   # НОВЫЙ
├── pages/
│   └── Subscriptions.tsx            # НОВЫЙ
├── stores/
│   └── subscriptionsStore.ts        # НОВЫЙ
├── lib/
│   └── api.ts                       # Обновить: добавить subscriptionsApi
└── types/
    └── index.ts                     # Обновить: добавить типы
```

---

## ✅ Критерии готовности

1. ✅ Можно создавать, редактировать и удалять абонементы
2. ✅ Абонемент "Все включено" создан автоматически
3. ✅ Все существующие клиенты имеют абонемент
4. ✅ При создании/редактировании клиента можно выбрать абонемент
5. ✅ При отметке посещения проверяется наличие и оплата абонемента
6. ✅ Визуально отображается статус оплаты

