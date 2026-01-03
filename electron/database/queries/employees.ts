import { getDatabase } from '../index'
import { createHash } from 'crypto'

export interface Employee {
  id: number
  full_name: string
  birth_year: number | null
  phone: string | null
  login: string | null
  password: string | null
  created_at: string
  updated_at: string
  sync_status: string
}

export interface CreateEmployeeDto {
  full_name: string
  birth_year?: number
  phone?: string
  login?: string
  password?: string
}

export interface UpdateEmployeeDto {
  full_name?: string
  birth_year?: number
  phone?: string
  login?: string
  password?: string
}

export const employeeQueries = {
  getAll(): Employee[] {
    const db = getDatabase()
    return db.prepare('SELECT * FROM employees ORDER BY full_name').all() as Employee[]
  },

  getById(id: number): Employee | undefined {
    const db = getDatabase()
    return db.prepare('SELECT * FROM employees WHERE id = ?').get(id) as Employee | undefined
  },

  create(data: CreateEmployeeDto): Employee {
    const db = getDatabase()
    const stmt = db.prepare(`
      INSERT INTO employees (full_name, birth_year, phone, login, password)
      VALUES (@full_name, @birth_year, @phone, @login, @password)
    `)
    const result = stmt.run({
      full_name: data.full_name,
      birth_year: data.birth_year ?? null,
      phone: data.phone ?? null,
      login: data.login ?? null,
      password: data.password ?? null
    })
    return this.getById(result.lastInsertRowid as number)!
  },

  update(id: number, data: UpdateEmployeeDto): Employee | undefined {
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
    if (data.login !== undefined) {
      fields.push('login = @login')
      values.login = data.login
    }
    if (data.password !== undefined) {
      fields.push('password = @password')
      values.password = data.password
    }

    if (fields.length === 0) return this.getById(id)

    fields.push("updated_at = CURRENT_TIMESTAMP")
    fields.push("sync_status = 'pending'")

    const stmt = db.prepare(`
      UPDATE employees SET ${fields.join(', ')} WHERE id = @id
    `)
    stmt.run(values)
    return this.getById(id)
  },

  delete(id: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM employees WHERE id = ?').run(id)
    return result.changes > 0
  },

  authenticate(login: string, password: string): Employee | null {
    const db = getDatabase()
    const passwordHash = createHash('sha256').update(password).digest('hex')
    
    const employee = db.prepare('SELECT * FROM employees WHERE login = ? AND password = ?').get(login, passwordHash) as Employee | undefined
    
    if (!employee) {
      const userExists = db.prepare('SELECT id, login FROM employees WHERE login = ?').get(login) as { id: number; login: string } | undefined
      if (userExists) {
        console.log(`User ${login} exists but password doesn't match`)
      } else {
        console.log(`User ${login} not found`)
      }
    }
    
    return employee || null
  }
}
