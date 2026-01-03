import { create } from 'zustand'
import { lessonsApi, attendanceApi } from '@/lib/api'
import type { Lesson, Attendance } from '@/types'

interface LessonsState {
  lessons: Lesson[]
  todayLessons: Lesson[]
  currentAttendance: Attendance[]
  isLoading: boolean
  totalCount: number
  currentPage: number
  pageSize: number
  filters: {
    groupId?: number
    startDate?: string
    endDate?: string
  }
  
  fetchLessons: () => Promise<void>
  fetchTodayLessons: () => Promise<void>
  fetchLessonsByDate: (date: string) => Promise<Lesson[]>
  setFilters: (filters: any) => void
  setPage: (page: number) => void
  
  generateLessons: (groupId: number, startDate: string, endDate: string) => Promise<number>
  deleteLesson: (id: number) => Promise<boolean>
  
  fetchAttendance: (lessonId: number) => Promise<void>
  updateAttendance: (lessonId: number, clientId: number, status: string | null) => Promise<void>
}

const getDefaultDateRange = () => {
  const today = new Date()
  const endDate = new Date(today)
  endDate.setDate(today.getDate() + 7)
  
  const formatDate = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  
  return {
    startDate: formatDate(today),
    endDate: formatDate(endDate)
  }
}

export const useLessonsStore = create<LessonsState>((set, get) => ({
  lessons: [],
  todayLessons: [],
  currentAttendance: [],
  isLoading: false,
  totalCount: 0,
  currentPage: 1,
  pageSize: 20,
  filters: getDefaultDateRange(),

  fetchLessons: async () => {
    set({ isLoading: true })
    try {
      const state = get()
      const result = await lessonsApi.getAll({
        ...state.filters,
        page: state.currentPage,
        limit: state.pageSize
      }) as { data: Lesson[]; total: number }
      
      if (result && typeof result === 'object' && 'data' in result && 'total' in result) {
        set({ 
          lessons: result.data || [], 
          totalCount: result.total || 0,
          isLoading: false 
        })
      } else {
        set({ 
          lessons: [], 
          totalCount: 0,
          isLoading: false 
        })
      }
    } catch (error) {
      console.error('Error fetching lessons:', error)
      set({ isLoading: false })
    }
  },

  fetchTodayLessons: async () => {
    const todayLessons = await lessonsApi.getTodayLessons() as Lesson[]
    set({ todayLessons })
  },

  fetchLessonsByDate: async (date: string) => {
    const lessons = await lessonsApi.getByDate(date) as Lesson[]
    return lessons
  },

  setFilters: (filters) => {
    set({ filters, currentPage: 1 })
    get().fetchLessons()
  },

  setPage: (page) => {
    set({ currentPage: page })
    get().fetchLessons()
  },

  generateLessons: async (groupId, startDate, endDate) => {
    const lessons = await lessonsApi.generateFromSchedule(groupId, startDate, endDate) as Lesson[]
    set({ currentPage: 1 })
    get().fetchLessons()
    return lessons.length
  },

  deleteLesson: async (id) => {
    const success = await lessonsApi.delete(id) as boolean
    if (success) {
      const state = get()
      const remainingOnPage = state.lessons.filter((l) => l.id !== id).length
      
      if (remainingOnPage === 0 && state.currentPage > 1) {
        set({ currentPage: state.currentPage - 1 })
      }
      
      set((state) => ({
        lessons: state.lessons.filter((l) => l.id !== id),
        todayLessons: state.todayLessons.filter((l) => l.id !== id)
      }))
      
      get().fetchLessons()
    }
    return success
  },

  fetchAttendance: async (lessonId) => {
    const currentAttendance = await attendanceApi.getByLesson(lessonId) as Attendance[]
    set({ currentAttendance })
  },

  updateAttendance: async (lessonId, clientId, status) => {
    await attendanceApi.updateStatus(lessonId, clientId, status)
    await get().fetchAttendance(lessonId)
    
    const updatedLesson = await lessonsApi.getById(lessonId) as Lesson
    if (updatedLesson) {
      set((state) => ({
        lessons: state.lessons.map((l) => 
          l.id === lessonId ? updatedLesson : l
        ),
        todayLessons: state.todayLessons.map((l) => 
          l.id === lessonId ? updatedLesson : l
        )
      }))
    }
  }
}))

