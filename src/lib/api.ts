export const employeesApi = {
  getAll: () => window.electronAPI.db.query('employees:getAll'),
  getById: (id: number) => window.electronAPI.db.query('employees:getById', id),
  create: (data: { full_name: string; birth_year?: number; phone?: string; login?: string; password?: string }) => 
    window.electronAPI.db.query('employees:create', data),
  update: (id: number, data: { full_name?: string; birth_year?: number; phone?: string; login?: string; password?: string }) =>
    window.electronAPI.db.query('employees:update', id, data),
  delete: (id: number) => window.electronAPI.db.query('employees:delete', id)
}

export const clientsApi = {
  getAll: () => window.electronAPI.db.query('clients:getAll'),
  getById: (id: number) => window.electronAPI.db.query('clients:getById', id),
  search: (query: string) => window.electronAPI.db.query('clients:search', query),
  getDebtors: (days?: number) => window.electronAPI.db.query('clients:getDebtors', days),
  create: (data: any) => window.electronAPI.db.query('clients:create', data),
  update: (id: number, data: any) => window.electronAPI.db.query('clients:update', id, data),
  updatePaymentDate: (id: number, date: string) => 
    window.electronAPI.db.query('clients:updatePaymentDate', id, date),
  delete: (id: number) => window.electronAPI.db.query('clients:delete', id),
  addParent: (clientId: number, data: { full_name: string; phone?: string }) =>
    window.electronAPI.db.query('clients:addParent', clientId, data),
  removeParent: (parentId: number) => window.electronAPI.db.query('clients:removeParent', parentId)
}

export const groupsApi = {
  getAll: () => window.electronAPI.db.query('groups:getAll'),
  getById: (id: number) => window.electronAPI.db.query('groups:getById', id),
  create: (data: any) => window.electronAPI.db.query('groups:create', data),
  update: (id: number, data: any) => window.electronAPI.db.query('groups:update', id, data),
  delete: (id: number) => window.electronAPI.db.query('groups:delete', id),
  addSchedule: (groupId: number, data: any) => 
    window.electronAPI.db.query('groups:addSchedule', groupId, data),
  updateSchedule: (scheduleId: number, data: any) =>
    window.electronAPI.db.query('groups:updateSchedule', scheduleId, data),
  removeSchedule: (scheduleId: number) => window.electronAPI.db.query('groups:removeSchedule', scheduleId),
  addMember: (groupId: number, clientId: number) =>
    window.electronAPI.db.query('groups:addMember', groupId, clientId),
  removeMember: (groupId: number, clientId: number) =>
    window.electronAPI.db.query('groups:removeMember', groupId, clientId),
  getScheduleForDay: (day: number) => window.electronAPI.db.query('groups:getScheduleForDay', day)
}

export const lessonsApi = {
  getAll: (filters?: any) => window.electronAPI.db.query('lessons:getAll', filters),
  getById: (id: number) => window.electronAPI.db.query('lessons:getById', id),
  getByDate: (date: string) => window.electronAPI.db.query('lessons:getByDate', date),
  getTodayLessons: () => window.electronAPI.db.query('lessons:getTodayLessons'),
  create: (data: any) => window.electronAPI.db.query('lessons:create', data),
  generateFromSchedule: (groupId: number, startDate: string, endDate: string) =>
    window.electronAPI.db.query('lessons:generateFromSchedule', groupId, startDate, endDate),
  delete: (id: number) => window.electronAPI.db.query('lessons:delete', id)
}

export const attendanceApi = {
  getByLesson: (lessonId: number) => window.electronAPI.db.query('attendance:getByLesson', lessonId),
  updateStatus: (lessonId: number, clientId: number, status: string | null) =>
    window.electronAPI.db.query('attendance:updateStatus', lessonId, clientId, status),
  getClientAttendance: (clientId: number, startDate?: string, endDate?: string) =>
    window.electronAPI.db.query('attendance:getClientAttendance', clientId, startDate, endDate),
  getStatsByGroup: (groupId: number) => window.electronAPI.db.query('attendance:getStatsByGroup', groupId)
}

export const authApi = {
  login: async (login: string, password: string) => {
    if (typeof window === 'undefined' || !window.electronAPI?.auth) {
      throw new Error('Electron API is not available. Please run the application in Electron.')
    }
    return window.electronAPI.auth.login(login, password)
  }
}

