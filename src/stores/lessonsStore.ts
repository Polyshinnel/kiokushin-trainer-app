import { create } from 'zustand'
import { lessonsApi, attendanceApi } from '@/lib/api'
import type { Lesson, Attendance } from '@/types'

interface LessonsState {
  lessons: Lesson[]
  todayLessons: Lesson[]
  currentAttendance: Attendance[]
  isLoading: boolean
  filters: {
    groupId?: number
    startDate?: string
    endDate?: string
  }
  
  fetchLessons: () => Promise<void>
  fetchTodayLessons: () => Promise<void>
  fetchLessonsByDate: (date: string) => Promise<Lesson[]>
  setFilters: (filters: any) => void
  
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
  filters: getDefaultDateRange(),

  fetchLessons: async () => {
    set({ isLoading: true })
    try {
      const lessons = await lessonsApi.getAll(get().filters) as Lesson[]
      set({ lessons, isLoading: false })
    } catch (error) {
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
    set({ filters })
    get().fetchLessons()
  },

  generateLessons: async (groupId, startDate, endDate) => {
    const lessons = await lessonsApi.generateFromSchedule(groupId, startDate, endDate) as Lesson[]
    get().fetchLessons()
    return lessons.length
  },

  deleteLesson: async (id) => {
    const success = await lessonsApi.delete(id) as boolean
    if (success) {
      set((state) => ({
        lessons: state.lessons.filter((l) => l.id !== id),
        todayLessons: state.todayLessons.filter((l) => l.id !== id)
      }))
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

