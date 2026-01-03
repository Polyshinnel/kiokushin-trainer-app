import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
}

export function formatTime(time: string): string {
  return time.slice(0, 5)
}

export function getDayName(dayOfWeek: number): string {
  const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
  return days[dayOfWeek]
}

export function getDayShortName(dayOfWeek: number): string {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  return days[dayOfWeek]
}

export function getAttendanceStatusText(status: string | null): string {
  switch (status) {
    case 'present': return 'Присутствовал'
    case 'absent': return 'Отсутствовал'
    case 'sick': return 'Болеет'
    default: return 'Не отмечен'
  }
}

export function getAttendanceStatusColor(status: string | null): string {
  switch (status) {
    case 'present': return 'bg-green-100 text-green-800'
    case 'absent': return 'bg-red-100 text-red-800'
    case 'sick': return 'bg-yellow-100 text-yellow-800'
    default: return 'bg-slate-100 text-slate-600'
  }
}

export function calculateAge(birthYear: number | null): string {
  if (!birthYear) return '—'
  const currentYear = new Date().getFullYear()
  return `${currentYear - birthYear} лет`
}

export function formatPhone(phone: string | null): string {
  if (!phone) return '—'
  return phone
}
