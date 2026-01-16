import { getDatabase } from '../index'
import { subscriptionQueries } from './subscriptions'

export interface Client {
  id: number
  full_name: string
  birth_date: string | null
  birth_year: number | null
  phone: string | null
  last_payment_date: string | null
  doc_type: 'passport' | 'certificate' | null
  doc_series: string | null
  doc_number: string | null
  doc_issued_by: string | null
  doc_issued_date: string | null
  home_address: string | null
  workplace: string | null
  created_at: string
  updated_at: string
  sync_status: string
  // Информация об абонементе (последняя запись client_subscriptions)
  current_subscription_id?: number | null
  current_subscription_type_id?: number | null
  current_subscription_name?: string | null
  current_subscription_price?: number | null
  current_subscription_start_date?: string | null
  current_subscription_end_date?: string | null
  current_subscription_visits_used?: number | null
  current_subscription_visits_total?: number | null
  current_subscription_is_paid?: number | null
  current_subscription_status?: 'paid' | 'unpaid' | 'expired' | 'none'
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
  birth_date?: string
  birth_year?: number
  phone?: string
  last_payment_date?: string
  subscription_id?: number
  subscription_start_date?: string
  doc_type?: 'passport' | 'certificate'
  doc_series?: string
  doc_number?: string
  doc_issued_by?: string
  doc_issued_date?: string
  home_address?: string
  workplace?: string
  parents?: { full_name: string; phone?: string }[]
}

export interface UpdateClientDto {
  full_name?: string
  birth_date?: string
  birth_year?: number
  phone?: string
  last_payment_date?: string
  subscription_id?: number
  subscription_start_date?: string
  doc_type?: 'passport' | 'certificate'
  doc_series?: string
  doc_number?: string
  doc_issued_by?: string
  doc_issued_date?: string
  home_address?: string
  workplace?: string
}

function normalizeDateString(value?: string | null): string | null {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  // Поддержка формата ДД.ММ.ГГГГ
  if (trimmed.includes('.')) {
    const [day, month, year] = trimmed.split('.')
    if (day && month && year) {
      const normalized = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      const parsed = new Date(normalized)
      return Number.isNaN(parsed.getTime()) ? null : normalized
    }
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : trimmed
}

function extractBirthYear(dateString: string | null): number | null {
  if (!dateString) return null
  const parsed = new Date(dateString)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getFullYear()
}

function normalizeFullName(fullName: string): string {
  return fullName.trim().replace(/\s+/g, ' ')
}

const latestSubscriptionJoin = `
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
`

const subscriptionStatusCase = `
  CASE
    WHEN ls.current_subscription_id IS NULL THEN 'none'
    WHEN ls.current_subscription_is_paid = 0 THEN 'unpaid'
    WHEN date(ls.current_subscription_end_date) < date('now') THEN 'expired'
    WHEN ls.current_subscription_visits_total > 0 
      AND ls.current_subscription_visits_used >= ls.current_subscription_visits_total THEN 'expired'
    ELSE 'paid'
  END
`

function buildSubscriptionFilter(filter?: 'active' | 'expired' | 'unpaid' | 'all'): string {
  if (!filter || filter === 'all') return ''

  if (filter === 'active') {
    return `
      AND ls.current_subscription_id IS NOT NULL
      AND ls.current_subscription_is_paid = 1
      AND date(ls.current_subscription_end_date) >= date('now')
      AND (ls.current_subscription_visits_total = 0 OR ls.current_subscription_visits_used < ls.current_subscription_visits_total)
    `
  }

  if (filter === 'expired') {
    return `
      AND (
        ls.current_subscription_id IS NULL
        OR date(ls.current_subscription_end_date) < date('now')
        OR (ls.current_subscription_visits_total > 0 AND ls.current_subscription_visits_used >= ls.current_subscription_visits_total)
      )
    `
  }

  // unpaid: считаем неоплаченным и отсутствие абонемента, и просрочку
  return `
    AND (
      ls.current_subscription_id IS NULL
      OR ls.current_subscription_is_paid = 0
      OR date(ls.current_subscription_end_date) < date('now')
      OR (ls.current_subscription_visits_total > 0 AND ls.current_subscription_visits_used >= ls.current_subscription_visits_total)
    )
  `
}

export const clientQueries = {
  getAll(filters?: { page?: number; limit?: number; searchQuery?: string; subscriptionStatus?: 'active' | 'expired' | 'unpaid' | 'all' }): { data: Client[]; total: number } {
    const db = getDatabase()
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    const offset = (page - 1) * limit
    
    let whereClause = 'WHERE 1=1'
    const params: unknown[] = []
    
    if (filters?.searchQuery) {
      whereClause += ' AND (c.full_name LIKE ? OR c.phone LIKE ?)'
      const searchPattern = `%${filters.searchQuery}%`
      params.push(searchPattern, searchPattern)
    }

    if (filters?.subscriptionStatus && filters.subscriptionStatus !== 'all') {
      whereClause += buildSubscriptionFilter(filters.subscriptionStatus)
    }
    
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM clients c
      ${latestSubscriptionJoin}
      ${whereClause}
    `
    const totalResult = db.prepare(countQuery).get(...params) as { total: number }
    const total = totalResult.total
    
    const dataQuery = `
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
        ${subscriptionStatusCase} as current_subscription_status
      FROM clients c
      ${latestSubscriptionJoin}
      ${whereClause}
      ORDER BY c.full_name
      LIMIT ? OFFSET ?
    `
    
    const data = db.prepare(dataQuery).all(...params, limit, offset) as Client[]
    
    return { data, total }
  },

  getById(id: number): ClientWithParents | undefined {
    const db = getDatabase()
    const client = db.prepare(`
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
        ${subscriptionStatusCase} as current_subscription_status
      FROM clients c
      ${latestSubscriptionJoin}
      WHERE c.id = ?
    `).get(id) as Client | undefined
    
    if (!client) return undefined
    
    const parents = db.prepare('SELECT * FROM clients_parents WHERE client_id = ?')
      .all(id) as ClientParent[]
    
    return { ...client, parents }
  },

  getDebtors(days?: number): Client[] {
    const db = getDatabase()
    void days
    const whereClause = 'WHERE 1=1 ' + buildSubscriptionFilter('unpaid')

    const dataQuery = `
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
        ${subscriptionStatusCase} as current_subscription_status
      FROM clients c
      ${latestSubscriptionJoin}
      ${whereClause}
      ORDER BY COALESCE(ls.current_subscription_end_date, c.created_at) ASC
    `

    return db.prepare(dataQuery).all() as Client[]
  },

  search(query: string, filters?: { page?: number; limit?: number; subscriptionStatus?: 'active' | 'expired' | 'unpaid' | 'all' }): { data: Client[]; total: number } {
    const db = getDatabase()
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    const offset = (page - 1) * limit
    
    const searchPattern = `%${query}%`
    
    let whereClause = 'WHERE (c.full_name LIKE ? OR c.phone LIKE ?)'
    const params: unknown[] = [searchPattern, searchPattern]

    if (filters?.subscriptionStatus && filters.subscriptionStatus !== 'all') {
      whereClause += buildSubscriptionFilter(filters.subscriptionStatus)
    }
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM clients c
      ${latestSubscriptionJoin}
      ${whereClause}
    `
    const totalResult = db.prepare(countQuery).get(...params) as { total: number }
    const total = totalResult.total
    
    const dataQuery = `
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
        ${subscriptionStatusCase} as current_subscription_status
      FROM clients c
      ${latestSubscriptionJoin}
      ${whereClause}
      ORDER BY c.full_name
      LIMIT ? OFFSET ?
    `
    const data = db.prepare(dataQuery).all(...params, limit, offset) as Client[]
    
    return { data, total }
  },

  create(data: CreateClientDto): ClientWithParents {
    const db = getDatabase()
    
    const createClient = db.transaction(() => {
      const normalizedFullName = normalizeFullName(data.full_name)
      const normalizedBirthDate = normalizeDateString(data.birth_date ?? null)
      const normalizedIssuedDate = normalizeDateString(data.doc_issued_date ?? null)
      const birthYear = data.birth_year !== undefined ? data.birth_year : extractBirthYear(normalizedBirthDate)

      if (normalizedBirthDate) {
        const existing = db.prepare(`
          SELECT id, full_name, birth_date 
          FROM clients
          WHERE LOWER(full_name) = LOWER(?) AND birth_date = ?
          LIMIT 1
        `).get(normalizedFullName, normalizedBirthDate) as Pick<Client, 'id' | 'full_name' | 'birth_date'> | undefined

        if (existing) {
          const duplicateError = new Error('CLIENT_DUPLICATE: Клиент с таким ФИО и датой рождения уже существует')
          ;(duplicateError as any).code = 'CLIENT_DUPLICATE'
          ;(duplicateError as any).details = existing
          throw duplicateError
        }
      }

      const stmt = db.prepare(`
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
      `)
      const result = stmt.run({
        full_name: normalizedFullName,
        birth_year: birthYear ?? null,
        birth_date: normalizedBirthDate,
        phone: data.phone ?? null,
        last_payment_date: data.last_payment_date ?? null,
        doc_type: data.doc_type ?? null,
        doc_series: data.doc_series ?? null,
        doc_number: data.doc_number ?? null,
        doc_issued_by: data.doc_issued_by ?? null,
        doc_issued_date: normalizedIssuedDate,
        home_address: data.home_address ?? null,
        workplace: data.workplace ?? null
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
    
    if (data.subscription_id) {
      const startDate = data.subscription_start_date || new Date().toISOString().split('T')[0]
      try {
        subscriptionQueries.assignSubscription({
          client_id: clientId,
          subscription_id: data.subscription_id,
          start_date: startDate,
          is_paid: true
        })
        db.prepare(`UPDATE clients SET last_payment_date = ? WHERE id = ?`).run(startDate, clientId)
      } catch (error) {
        console.error('Error assigning subscription on client create:', error)
      }
    }

    return this.getById(clientId)!
  },

  update(id: number, data: UpdateClientDto): ClientWithParents | undefined {
    const db = getDatabase()
    const fields: string[] = []
    const values: Record<string, unknown> = { id }

    const normalizedBirthDate = data.birth_date !== undefined 
      ? normalizeDateString(data.birth_date) 
      : undefined
    const normalizedIssuedDate = data.doc_issued_date !== undefined
      ? normalizeDateString(data.doc_issued_date)
      : undefined
    const derivedBirthYear = data.birth_year !== undefined
      ? data.birth_year
      : normalizedBirthDate !== undefined
        ? extractBirthYear(normalizedBirthDate)
        : undefined

    if (data.full_name !== undefined) {
      fields.push('full_name = @full_name')
      values.full_name = data.full_name
    }
    if (derivedBirthYear !== undefined) {
      fields.push('birth_year = @birth_year')
      values.birth_year = derivedBirthYear
    }
    if (normalizedBirthDate !== undefined) {
      fields.push('birth_date = @birth_date')
      values.birth_date = normalizedBirthDate
    }
    if (data.phone !== undefined) {
      fields.push('phone = @phone')
      values.phone = data.phone
    }
    if (data.last_payment_date !== undefined) {
      fields.push('last_payment_date = @last_payment_date')
      values.last_payment_date = data.last_payment_date
    }
    if (data.doc_type !== undefined) {
      fields.push('doc_type = @doc_type')
      values.doc_type = data.doc_type ?? null
    }
    if (data.doc_series !== undefined) {
      fields.push('doc_series = @doc_series')
      values.doc_series = data.doc_series ?? null
    }
    if (data.doc_number !== undefined) {
      fields.push('doc_number = @doc_number')
      values.doc_number = data.doc_number ?? null
    }
    if (data.doc_issued_by !== undefined) {
      fields.push('doc_issued_by = @doc_issued_by')
      values.doc_issued_by = data.doc_issued_by ?? null
    }
    if (normalizedIssuedDate !== undefined) {
      fields.push('doc_issued_date = @doc_issued_date')
      values.doc_issued_date = normalizedIssuedDate
    }
    if (data.home_address !== undefined) {
      fields.push('home_address = @home_address')
      values.home_address = data.home_address ?? null
    }
    if (data.workplace !== undefined) {
      fields.push('workplace = @workplace')
      values.workplace = data.workplace ?? null
    }
    if (data.subscription_id !== undefined) {
      // храним выбранный тип абонемента в клиенте для удобства отчётов
      fields.push('last_payment_date = @last_payment_date')
      const startDate = data.subscription_start_date || new Date().toISOString().split('T')[0]
      values.last_payment_date = startDate
    }

    if (fields.length === 0) return this.getById(id)

    fields.push("updated_at = CURRENT_TIMESTAMP")
    fields.push("sync_status = 'pending'")

    db.prepare(`UPDATE clients SET ${fields.join(', ')} WHERE id = @id`).run(values)
    
    if (data.subscription_id !== undefined) {
      const startDate = data.subscription_start_date || new Date().toISOString().split('T')[0]
      const existingSubs = subscriptionQueries.getClientSubscriptions(id)
      const latestSub = existingSubs.length > 0 ? existingSubs[0] : undefined

      if (!latestSub || latestSub.subscription_id !== data.subscription_id) {
        try {
          subscriptionQueries.assignSubscription({
            client_id: id,
            subscription_id: data.subscription_id,
            start_date: startDate,
            is_paid: true
          })
        } catch (error) {
          console.error('Error assigning subscription on client update:', error)
        }
      }
    }

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
