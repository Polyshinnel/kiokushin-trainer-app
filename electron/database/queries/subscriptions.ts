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
  sync_status?: string
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
      ORDER BY 
        CASE WHEN cs.is_paid = 1 THEN 0 ELSE 1 END,
        CASE WHEN cs.visits_total > 0 THEN 0 ELSE 1 END,
        cs.end_date ASC,
        cs.start_date DESC
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

