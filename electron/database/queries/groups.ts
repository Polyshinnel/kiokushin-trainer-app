import { getDatabase } from '../index'
import type { Employee } from './employees'
import type { Client } from './clients'

export interface Group {
  id: number
  name: string
  start_date: string | null
  trainer_id: number | null
  created_at: string
  updated_at: string
  sync_status: string
}

export interface GroupSchedule {
  id: number
  group_id: number
  day_of_week: number
  start_time: string
  end_time: string
}

export interface GroupMember {
  id: number
  group_id: number
  client_id: number
  joined_at: string
  client?: Client
}

export interface GroupWithDetails extends Group {
  trainer?: Employee
  schedule: GroupSchedule[]
  members: GroupMember[]
  member_count: number
}

export interface CreateGroupDto {
  name: string
  start_date?: string
  trainer_id?: number
  schedule?: { day_of_week: number; start_time: string; end_time: string }[]
}

export interface UpdateGroupDto {
  name?: string
  start_date?: string
  trainer_id?: number
}

export const groupQueries = {
  getAll(): (Group & { trainer_name: string | null; member_count: number })[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT 
        g.*,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
      FROM groups g
      LEFT JOIN employees e ON g.trainer_id = e.id
      ORDER BY g.name
    `).all() as (Group & { trainer_name: string | null; member_count: number })[]
  },

  getById(id: number): GroupWithDetails | undefined {
    const db = getDatabase()
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined
    
    if (!group) return undefined
    
    const trainer = group.trainer_id
      ? db.prepare('SELECT * FROM employees WHERE id = ?').get(group.trainer_id) as Employee
      : undefined
    
    const schedule = db.prepare('SELECT * FROM group_schedule WHERE group_id = ? ORDER BY day_of_week')
      .all(id) as GroupSchedule[]
    
    const members = db.prepare(`
      SELECT gm.*, c.full_name, c.phone, c.birth_year
      FROM group_members gm
      JOIN clients c ON gm.client_id = c.id
      WHERE gm.group_id = ?
      ORDER BY c.full_name
    `).all(id) as (GroupMember & { full_name: string; phone: string; birth_year: number })[]
    
    return {
      ...group,
      trainer,
      schedule,
      members: members.map(m => ({
        ...m,
        client: { 
          id: m.client_id, 
          full_name: m.full_name, 
          phone: m.phone,
          birth_year: m.birth_year
        } as Client
      })),
      member_count: members.length
    }
  },

  getByTrainer(trainerId: number): Group[] {
    const db = getDatabase()
    return db.prepare('SELECT * FROM groups WHERE trainer_id = ?').all(trainerId) as Group[]
  },

  create(data: CreateGroupDto): GroupWithDetails {
    const db = getDatabase()
    
    const createGroup = db.transaction(() => {
      const stmt = db.prepare(`
        INSERT INTO groups (name, start_date, trainer_id)
        VALUES (@name, @start_date, @trainer_id)
      `)
      const result = stmt.run({
        name: data.name,
        start_date: data.start_date ?? null,
        trainer_id: data.trainer_id ?? null
      })
      
      const groupId = result.lastInsertRowid as number
      
      if (data.schedule && data.schedule.length > 0) {
        const scheduleStmt = db.prepare(`
          INSERT INTO group_schedule (group_id, day_of_week, start_time, end_time)
          VALUES (@group_id, @day_of_week, @start_time, @end_time)
        `)
        
        for (const slot of data.schedule) {
          scheduleStmt.run({
            group_id: groupId,
            day_of_week: slot.day_of_week,
            start_time: slot.start_time,
            end_time: slot.end_time
          })
        }
      }
      
      return groupId
    })
    
    const groupId = createGroup()
    return this.getById(groupId)!
  },

  update(id: number, data: UpdateGroupDto): GroupWithDetails | undefined {
    const db = getDatabase()
    const fields: string[] = []
    const values: Record<string, unknown> = { id }

    if (data.name !== undefined) {
      fields.push('name = @name')
      values.name = data.name
    }
    if (data.start_date !== undefined) {
      fields.push('start_date = @start_date')
      values.start_date = data.start_date
    }
    if (data.trainer_id !== undefined) {
      fields.push('trainer_id = @trainer_id')
      values.trainer_id = data.trainer_id
    }

    if (fields.length === 0) return this.getById(id)

    fields.push("updated_at = CURRENT_TIMESTAMP")
    fields.push("sync_status = 'pending'")

    db.prepare(`UPDATE groups SET ${fields.join(', ')} WHERE id = @id`).run(values)
    return this.getById(id)
  },

  delete(id: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM groups WHERE id = ?').run(id)
    return result.changes > 0
  },

  addSchedule(groupId: number, data: { day_of_week: number; start_time: string; end_time: string }): GroupSchedule {
    const db = getDatabase()
    const result = db.prepare(`
      INSERT INTO group_schedule (group_id, day_of_week, start_time, end_time)
      VALUES (@group_id, @day_of_week, @start_time, @end_time)
    `).run({
      group_id: groupId,
      ...data
    })
    
    db.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(groupId)
    
    return db.prepare('SELECT * FROM group_schedule WHERE id = ?')
      .get(result.lastInsertRowid) as GroupSchedule
  },

  updateSchedule(scheduleId: number, data: { day_of_week?: number; start_time?: string; end_time?: string }): void {
    const db = getDatabase()
    const fields: string[] = []
    const values: Record<string, unknown> = { id: scheduleId }

    if (data.day_of_week !== undefined) {
      fields.push('day_of_week = @day_of_week')
      values.day_of_week = data.day_of_week
    }
    if (data.start_time !== undefined) {
      fields.push('start_time = @start_time')
      values.start_time = data.start_time
    }
    if (data.end_time !== undefined) {
      fields.push('end_time = @end_time')
      values.end_time = data.end_time
    }

    if (fields.length > 0) {
      fields.push("sync_status = 'pending'")
      db.prepare(`UPDATE group_schedule SET ${fields.join(', ')} WHERE id = @id`).run(values)
    }
  },

  removeSchedule(scheduleId: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM group_schedule WHERE id = ?').run(scheduleId)
    return result.changes > 0
  },

  addMember(groupId: number, clientId: number): GroupMember {
    const db = getDatabase()
    const addMemberTx = db.transaction(() => {
      const insertResult = db.prepare(`
        INSERT INTO group_members (group_id, client_id)
        VALUES (?, ?)
      `).run(groupId, clientId)

      const memberId = insertResult.lastInsertRowid as number
      const member = db.prepare('SELECT * FROM group_members WHERE id = ?')
        .get(memberId) as GroupMember

      const lessons = db.prepare(`
        SELECT id 
        FROM lessons 
        WHERE group_id = ? AND lesson_date >= ?
      `).all(groupId, member.joined_at) as { id: number }[]

      const attendanceStmt = db.prepare(`
        INSERT OR IGNORE INTO attendance (lesson_id, client_id, status)
        VALUES (?, ?, NULL)
      `)

      for (const lesson of lessons) {
        attendanceStmt.run(lesson.id, clientId)
      }

      db.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(groupId)

      return member
    })

    return addMemberTx()
  },

  removeMember(groupId: number, clientId: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM group_members WHERE group_id = ? AND client_id = ?')
      .run(groupId, clientId)
    
    if (result.changes > 0) {
      db.prepare("UPDATE groups SET sync_status = 'pending' WHERE id = ?").run(groupId)
    }
    
    return result.changes > 0
  },

  getScheduleForDay(dayOfWeek: number): (GroupSchedule & { group_name: string; trainer_name: string | null })[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT gs.*, g.name as group_name, e.full_name as trainer_name
      FROM group_schedule gs
      JOIN groups g ON gs.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      WHERE gs.day_of_week = ?
      ORDER BY gs.start_time
    `).all(dayOfWeek) as (GroupSchedule & { group_name: string; trainer_name: string | null })[]
  }
}
