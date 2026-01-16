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
  client_name?: string
  created_at: string
  updated_at: string
}

export interface GroupAttendanceMatrix {
  lessons: Lesson[]
  members: {
    client_id: number
    client_name: string
    client_phone: string | null
  }[]
  attendance: Record<number, Record<number, AttendanceStatus>>
}

export interface CalendarDay {
  date: Date
  dayOfMonth: number
  isCurrentMonth: boolean
  lessons: Lesson[]
}