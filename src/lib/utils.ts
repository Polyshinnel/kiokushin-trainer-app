import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function parseDateInput(date: string | Date | null | undefined): Date | null {
  if (!date) return null

  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date
  }

  const trimmed = date.trim()
  if (!trimmed) return null

  if (/^\d{4}$/.test(trimmed)) {
    const numericDate = new Date(parseInt(trimmed, 10), 0, 1)
    return Number.isNaN(numericDate.getTime()) ? null : numericDate
  }

  if (trimmed.includes('.')) {
    const [day, month, year] = trimmed.split('.')
    if (day && month && year) {
      const parsed = new Date(`${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
      return Number.isNaN(parsed.getTime()) ? null : parsed
    }
  }

  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function formatDate(date: string | Date): string {
  const parsed = parseDateInput(date)
  if (!parsed) return '—'
  return parsed.toLocaleDateString('ru-RU', {
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

export function calculateAge(birthDateOrYear: string | number | null | undefined): string {
  if (birthDateOrYear === null || birthDateOrYear === undefined) return '—'

  if (typeof birthDateOrYear === 'number') {
    const currentYear = new Date().getFullYear()
    return `${currentYear - birthDateOrYear} лет`
  }

  const parsedDate = parseDateInput(birthDateOrYear)
  if (!parsedDate) return '—'

  const today = new Date()
  let age = today.getFullYear() - parsedDate.getFullYear()
  const hasHadBirthday =
    today.getMonth() > parsedDate.getMonth() ||
    (today.getMonth() === parsedDate.getMonth() && today.getDate() >= parsedDate.getDate())

  if (!hasHadBirthday) {
    age -= 1
  }

  if (age < 0 || Number.isNaN(age)) return '—'
  return `${age} лет`
}

export function formatPhone(phone: string | null): string {
  if (!phone) return '—'
  return phone
}
