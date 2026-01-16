import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Check, X, ThermometerSun, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { attendanceApi } from '@/lib/api'
import { toast } from 'sonner'
import type { Lesson, AttendanceStatus } from '@/types'

interface AttendanceCalendarProps {
  year: number
  month: number // 1-12
  lessons: Lesson[]
  members: { client_id: number; client_name: string; client_phone: string | null }[]
  attendance: Record<number, Record<number, AttendanceStatus>>
  onAttendanceChange: () => void
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: React.ReactNode; bgColor: string; textColor: string }[] = [
  { value: 'present', label: 'Был', icon: <Check className="w-3 h-3" />, bgColor: 'bg-green-200', textColor: 'text-green-700' },
  { value: 'absent', label: 'Не был', icon: <X className="w-3 h-3" />, bgColor: 'bg-red-200', textColor: 'text-red-700' },
  { value: 'sick', label: 'Болел', icon: <ThermometerSun className="w-3 h-3" />, bgColor: 'bg-amber-200', textColor: 'text-amber-700' },
  { value: null, label: 'Не отмечен', icon: <HelpCircle className="w-3 h-3" />, bgColor: 'bg-slate-200', textColor: 'text-slate-500' },
]

export function AttendanceCalendar({
  year,
  month,
  lessons,
  members,
  attendance,
  onAttendanceChange
}: AttendanceCalendarProps) {
  
  // Получаем все дни месяца с занятиями
  const calendarData = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate()
    const firstDayOfWeek = (new Date(year, month - 1, 1).getDay() + 6) % 7 // Пн = 0
    
    // Создаём карту занятий по дням
    const lessonsByDay: Record<number, Lesson[]> = {}
    for (const lesson of lessons) {
      const day = parseInt(lesson.lesson_date.split('-')[2])
      if (!lessonsByDay[day]) {
        lessonsByDay[day] = []
      }
      lessonsByDay[day].push(lesson)
    }
    
    // Генерируем дни для отображения
    const days: { day: number; lessons: Lesson[]; isLessonDay: boolean }[] = []
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayLessons = lessonsByDay[day] || []
      days.push({
        day,
        lessons: dayLessons,
        isLessonDay: dayLessons.length > 0
      })
    }
    
    return { days, firstDayOfWeek, daysInMonth }
  }, [year, month, lessons])

  // Получаем статус посещаемости
  const getStatus = (lessonId: number, clientId: number): AttendanceStatus => {
    return attendance[lessonId]?.[clientId] ?? null
  }

  // Получаем иконку для статуса
  const getStatusDisplay = (status: AttendanceStatus) => {
    const option = STATUS_OPTIONS.find(o => o.value === status) || STATUS_OPTIONS[3]
    return (
      <span className={cn('w-5 h-5 rounded flex items-center justify-center transition-colors', option.bgColor, option.textColor)}>
        {option.icon}
      </span>
    )
  }

  // Обработчик изменения статуса
  const handleStatusChange = async (lessonId: number, clientId: number, status: AttendanceStatus) => {
    try {
      await attendanceApi.updateStatus(lessonId, clientId, status)
      onAttendanceChange()
      toast.success('Посещаемость обновлена')
    } catch (error) {
      toast.error('Ошибка обновления')
    }
  }

  // Только дни с занятиями
  const lessonDays = calendarData.days.filter(d => d.isLessonDay)

  if (lessonDays.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Нет занятий в этом месяце</p>
        <p className="text-sm mt-1">Сгенерируйте занятия на странице "Занятия"</p>
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Нет участников в группе</p>
      </div>
    )
  }

  // Проверка, является ли день сегодняшним
  const today = new Date()
  const isToday = (day: number) => 
    year === today.getFullYear() && 
    month === today.getMonth() + 1 && 
    day === today.getDate()

  return (
    <div className="overflow-auto animate-in fade-in duration-300">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="sticky left-0 bg-slate-50 border border-slate-200 p-2 text-left min-w-[200px] sm:min-w-[250px] z-10">
              Участник
            </th>
            {lessonDays.map((dayData) => (
              <th
                key={dayData.day}
                className={cn(
                  'border border-slate-200 p-2 text-center min-w-[60px] sm:min-w-[70px]',
                  'bg-emerald-50 border-emerald-200',
                  isToday(dayData.day) && 'ring-2 ring-blue-500'
                )}
              >
                <div className="font-medium">{dayData.day}</div>
                <div className="text-xs text-slate-500 font-normal">
                  {dayData.lessons[0]?.start_time?.slice(0, 5)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.client_id} className="hover:bg-slate-50 transition-colors">
              <td className="sticky left-0 bg-white border border-slate-200 p-2 z-10">
                <div className="font-medium truncate">{member.client_name}</div>
                {member.client_phone && (
                  <div className="text-xs text-slate-500">{member.client_phone}</div>
                )}
              </td>
              {lessonDays.map((dayData) => {
                const lesson = dayData.lessons[0] // Берём первое занятие дня
                const status = getStatus(lesson.id, member.client_id)
                
                return (
                  <td
                    key={dayData.day}
                    className="border border-slate-200 p-1 sm:p-2 text-center bg-emerald-50/50"
                  >
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-8 p-0 hover:bg-slate-100 transition-colors"
                        >
                          {getStatusDisplay(status)}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-1 animate-in fade-in-0 zoom-in-95">
                        {STATUS_OPTIONS.map((option) => (
                          <Button
                            key={option.value ?? 'null'}
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start gap-2"
                            onClick={() => handleStatusChange(lesson.id, member.client_id, option.value)}
                          >
                            <span className={cn('w-5 h-5 rounded flex items-center justify-center', option.bgColor, option.textColor)}>
                              {option.icon}
                            </span>
                            {option.label}
                          </Button>
                        ))}
                      </PopoverContent>
                    </Popover>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
