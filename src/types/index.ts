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

export interface Group {
  id: number
  name: string
  start_date: string | null
  trainer_id: number | null
  trainer_name?: string
  member_count?: number
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

export interface Lesson {
  id: number
  group_id: number
  group_name?: string
  trainer_name?: string
  lesson_date: string
  start_time: string
  end_time: string
  attendance_count?: number
  total_members?: number
  created_at: string
  sync_status: string
}

export type AttendanceStatus = 'present' | 'absent' | 'sick' | null

export interface Attendance {
  id: number
  lesson_id: number
  client_id: number
  client_name?: string
  client_phone?: string
  status: AttendanceStatus
  updated_at: string
}

export interface NavItem {
  title: string
  path: string
  icon: React.ReactNode
}

