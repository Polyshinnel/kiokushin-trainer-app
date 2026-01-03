import { getDatabase } from '../index'

export interface Lesson {
  id: number
  group_id: number
  lesson_date: string
  start_time: string
  end_time: string
  created_at: string
  sync_status: string
}

export interface LessonWithDetails extends Lesson {
  group_name: string
  trainer_name: string | null
  attendance_count: number
  total_members: number
}

export interface Attendance {
  id: number
  lesson_id: number
  client_id: number
  status: 'present' | 'absent' | 'sick' | null
  updated_at: string
}

export interface AttendanceWithClient extends Attendance {
  client_name: string
  client_phone: string | null
}

export const lessonQueries = {
  getAll(filters?: { groupId?: number; startDate?: string; endDate?: string; page?: number; limit?: number }): { data: LessonWithDetails[]; total: number } {
    const db = getDatabase()
    const page = filters?.page || 1
    const limit = filters?.limit || 30
    const offset = (page - 1) * limit
    
    let whereClause = 'WHERE 1=1'
    const params: unknown[] = []
    
    if (filters?.groupId) {
      whereClause += ' AND l.group_id = ?'
      params.push(filters.groupId)
    }
    if (filters?.startDate) {
      whereClause += ' AND l.lesson_date >= ?'
      params.push(filters.startDate)
    }
    if (filters?.endDate) {
      whereClause += ' AND l.lesson_date <= ?'
      params.push(filters.endDate)
    }
    
    const countQuery = `
      SELECT COUNT(*) as total
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      ${whereClause}
    `
    
    const totalResult = db.prepare(countQuery).get(...params) as { total: number }
    const total = totalResult.total
    
    const dataQuery = `
      SELECT 
        l.*,
        g.name as group_name,
        e.full_name as trainer_name,
        (SELECT COUNT(*) FROM attendance WHERE lesson_id = l.id AND status IS NOT NULL) as attendance_count,
        (SELECT COUNT(*) FROM group_members WHERE group_id = l.group_id) as total_members
      FROM lessons l
      JOIN groups g ON l.group_id = g.id
      LEFT JOIN employees e ON g.trainer_id = e.id
      ${whereClause}
      ORDER BY l.lesson_date ASC, l.start_time ASC
      LIMIT ? OFFSET ?
    `
    
    const data = db.prepare(dataQuery).all(...params, limit, offset) as LessonWithDetails[]
    
    return { data, total }
  },

  getById(id: number): LessonWithDetails | undefined {
    const db = getDatabase()
    return db.prepare(`
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
    `).get(id) as LessonWithDetails | undefined
  },

  getByDate(date: string): LessonWithDetails[] {
    const db = getDatabase()
    return db.prepare(`
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
    `).all(date) as LessonWithDetails[]
  },

  getTodayLessons(): LessonWithDetails[] {
    return this.getByDate(new Date().toISOString().split('T')[0])
  },

  create(data: { group_id: number; lesson_date: string; start_time: string; end_time: string }): Lesson {
    const db = getDatabase()
    
    const createLesson = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO lessons (group_id, lesson_date, start_time, end_time)
        VALUES (@group_id, @lesson_date, @start_time, @end_time)
      `).run(data)
      
      const lessonId = result.lastInsertRowid as number
      
      const members = db.prepare('SELECT client_id FROM group_members WHERE group_id = ?')
        .all(data.group_id) as { client_id: number }[]
      
      const attendanceStmt = db.prepare(`
        INSERT INTO attendance (lesson_id, client_id, status)
        VALUES (?, ?, NULL)
      `)
      
      for (const member of members) {
        attendanceStmt.run(lessonId, member.client_id)
      }
      
      return lessonId
    })
    
    const lessonId = createLesson()
    return db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId) as Lesson
  },

  generateFromSchedule(groupId: number, startDate: string, endDate: string): Lesson[] {
    const db = getDatabase()
    
    const schedule = db.prepare('SELECT * FROM group_schedule WHERE group_id = ?')
      .all(groupId) as { day_of_week: number; start_time: string; end_time: string }[]
    
    if (schedule.length === 0) return []
    
    const createdLessons: Lesson[] = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = (date.getDay() + 6) % 7
      
      const daySchedule = schedule.find(s => s.day_of_week === dayOfWeek)
      if (daySchedule) {
        const lessonDate = date.toISOString().split('T')[0]
        
        const existing = db.prepare(`
          SELECT id FROM lessons WHERE group_id = ? AND lesson_date = ?
        `).get(groupId, lessonDate)
        
        if (!existing) {
          const lesson = this.create({
            group_id: groupId,
            lesson_date: lessonDate,
            start_time: daySchedule.start_time,
            end_time: daySchedule.end_time
          })
          createdLessons.push(lesson)
        }
      }
    }
    
    return createdLessons
  },

  delete(id: number): boolean {
    const db = getDatabase()
    const result = db.prepare('DELETE FROM lessons WHERE id = ?').run(id)
    return result.changes > 0
  }
}

export const attendanceQueries = {
  getByLesson(lessonId: number): AttendanceWithClient[] {
    const db = getDatabase()
    return db.prepare(`
      SELECT a.*, c.full_name as client_name, c.phone as client_phone
      FROM attendance a
      JOIN clients c ON a.client_id = c.id
      JOIN lessons l ON a.lesson_id = l.id
      JOIN group_members gm ON l.group_id = gm.group_id AND a.client_id = gm.client_id
      WHERE a.lesson_id = ?
      ORDER BY c.full_name
    `).all(lessonId) as AttendanceWithClient[]
  },

  updateStatus(lessonId: number, clientId: number, status: 'present' | 'absent' | 'sick' | null): Attendance {
    const db = getDatabase()
    
    db.prepare(`
      INSERT INTO attendance (lesson_id, client_id, status, updated_at, sync_status)
      VALUES (@lesson_id, @client_id, @status, CURRENT_TIMESTAMP, 'pending')
      ON CONFLICT(lesson_id, client_id) DO UPDATE SET
        status = @status,
        updated_at = CURRENT_TIMESTAMP,
        sync_status = 'pending'
    `).run({ lesson_id: lessonId, client_id: clientId, status })
    
    return db.prepare('SELECT * FROM attendance WHERE lesson_id = ? AND client_id = ?')
      .get(lessonId, clientId) as Attendance
  },

  getClientAttendance(clientId: number, startDate?: string, endDate?: string): (Attendance & { lesson_date: string; group_name: string; start_time: string; end_time: string })[] {
    const db = getDatabase()
    let query = `
      SELECT a.*, l.lesson_date, l.start_time, l.end_time, g.name as group_name
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      JOIN groups g ON l.group_id = g.id
      WHERE a.client_id = ?
    `
    
    const params: unknown[] = [clientId]
    
    if (startDate) {
      query += ' AND l.lesson_date >= ?'
      params.push(startDate)
    }
    if (endDate) {
      query += ' AND l.lesson_date <= ?'
      params.push(endDate)
    }
    
    query += ' ORDER BY l.lesson_date DESC'
    
    return db.prepare(query).all(...params) as (Attendance & { lesson_date: string; group_name: string; start_time: string; end_time: string })[]
  },

  getStatsByGroup(groupId: number): { present: number; absent: number; sick: number; total: number } {
    const db = getDatabase()
    const result = db.prepare(`
      SELECT 
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent,
        SUM(CASE WHEN a.status = 'sick' THEN 1 ELSE 0 END) as sick,
        COUNT(*) as total
      FROM attendance a
      JOIN lessons l ON a.lesson_id = l.id
      WHERE l.group_id = ?
    `).get(groupId) as { present: number; absent: number; sick: number; total: number }
    
    return result
  }
}
