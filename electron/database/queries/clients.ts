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
  getAll(filters?: { page?: number; limit?: number; searchQuery?: string }): { data: Client[]; total: number } {
    const db = getDatabase()
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    const offset = (page - 1) * limit
    
    let whereClause = 'WHERE 1=1'
    const params: unknown[] = []
    
    if (filters?.searchQuery) {
      whereClause += ' AND (full_name LIKE ? OR phone LIKE ?)'
      const searchPattern = `%${filters.searchQuery}%`
      params.push(searchPattern, searchPattern)
    }
    
    const countQuery = `SELECT COUNT(*) as total FROM clients ${whereClause}`
    const totalResult = db.prepare(countQuery).get(...params) as { total: number }
    const total = totalResult.total
    
    const dataQuery = `
      SELECT * FROM clients 
      ${whereClause}
      ORDER BY full_name
      LIMIT ? OFFSET ?
    `
    
    const data = db.prepare(dataQuery).all(...params, limit, offset) as Client[]
    
    return { data, total }
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

  search(query: string, filters?: { page?: number; limit?: number }): { data: Client[]; total: number } {
    const db = getDatabase()
    const page = filters?.page || 1
    const limit = filters?.limit || 20
    const offset = (page - 1) * limit
    
    const searchPattern = `%${query}%`
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM clients 
      WHERE full_name LIKE ? OR phone LIKE ?
    `
    const totalResult = db.prepare(countQuery).get(searchPattern, searchPattern) as { total: number }
    const total = totalResult.total
    
    const dataQuery = `
      SELECT * FROM clients 
      WHERE full_name LIKE ? OR phone LIKE ?
      ORDER BY full_name
      LIMIT ? OFFSET ?
    `
    const data = db.prepare(dataQuery).all(searchPattern, searchPattern, limit, offset) as Client[]
    
    return { data, total }
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
