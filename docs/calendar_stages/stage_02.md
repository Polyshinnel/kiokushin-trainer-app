# Этап 2: Frontend — компоненты

**Срок:** 3-4 часа

## Задачи

- [x] Добавить типы в `src/types/index.ts`
- [x] Создать `GroupCalendarDialog.tsx`
- [x] Создать `AttendanceCalendar.tsx`
- [x] Обновить `GroupsList.tsx` — добавить иконку календаря

---

## 2.1 Типы TypeScript

**Обновить файл:** `src/types/index.ts`

Добавить новые типы для календаря:

```typescript
// Добавить новые типы

export type AttendanceStatus = 'present' | 'absent' | 'sick' | null

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
```

---

## 2.2 Компонент диалога календаря

**Новый файл:** `src/components/groups/GroupCalendarDialog.tsx`

```tsx
import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AttendanceCalendar } from './AttendanceCalendar'
import { lessonsApi } from '@/lib/api'
import type { Group, GroupAttendanceMatrix } from '@/types'

interface GroupCalendarDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group: Group | null
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

export function GroupCalendarDialog({ open, onOpenChange, group }: GroupCalendarDialogProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1) // 1-12
  const [data, setData] = useState<GroupAttendanceMatrix | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Загрузка данных при открытии или смене месяца
  useEffect(() => {
    if (open && group) {
      loadData()
    }
  }, [open, group, year, month])

  const loadData = async () => {
    if (!group) return
    setIsLoading(true)
    try {
      const result = await lessonsApi.getGroupAttendanceMatrix(group.id, year, month) as GroupAttendanceMatrix
      setData(result)
    } catch (error) {
      console.error('Error loading attendance matrix:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear(year - 1)
    } else {
      setMonth(month - 1)
    }
  }

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear(year + 1)
    } else {
      setMonth(month + 1)
    }
  }

  if (!group) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Календарь посещаемости — {group.name}</DialogTitle>
            
            {/* Навигация по месяцам */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-medium min-w-[140px] text-center">
                {MONTH_NAMES[month - 1]} {year}
              </span>
              <Button variant="ghost" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-500">Загрузка...</p>
            </div>
          ) : data ? (
            <AttendanceCalendar
              year={year}
              month={month}
              lessons={data.lessons}
              members={data.members}
              attendance={data.attendance}
              onAttendanceChange={loadData}
            />
          ) : (
            <div className="flex items-center justify-center py-12">
              <p className="text-slate-500">Нет данных</p>
            </div>
          )}
        </div>

        {/* Легенда */}
        <div className="flex items-center gap-4 pt-4 border-t text-sm text-slate-600">
          <span className="font-medium">Легенда:</span>
          <div className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-green-100 flex items-center justify-center text-green-600 text-xs">✓</span>
            <span>Был</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-red-100 flex items-center justify-center text-red-600 text-xs">✗</span>
            <span>Не был</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-yellow-100 flex items-center justify-center text-yellow-600 text-xs">🤒</span>
            <span>Болел</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-5 h-5 rounded bg-emerald-50 border border-emerald-200"></span>
            <span>День занятия</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 2.3 Компонент календарной сетки

**Новый файл:** `src/components/groups/AttendanceCalendar.tsx`

```tsx
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
  { value: 'present', label: 'Был', icon: <Check className="w-3 h-3" />, bgColor: 'bg-green-100', textColor: 'text-green-600' },
  { value: 'absent', label: 'Не был', icon: <X className="w-3 h-3" />, bgColor: 'bg-red-100', textColor: 'text-red-600' },
  { value: 'sick', label: 'Болел', icon: <ThermometerSun className="w-3 h-3" />, bgColor: 'bg-yellow-100', textColor: 'text-yellow-600' },
  { value: null, label: 'Не отмечен', icon: <HelpCircle className="w-3 h-3" />, bgColor: 'bg-slate-100', textColor: 'text-slate-400' },
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
      <span className={cn('w-5 h-5 rounded flex items-center justify-center', option.bgColor, option.textColor)}>
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

  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-slate-50">
            <th className="sticky left-0 bg-slate-50 border border-slate-200 p-2 text-left min-w-[200px] z-10">
              Участник
            </th>
            {lessonDays.map((dayData) => (
              <th
                key={dayData.day}
                className={cn(
                  'border border-slate-200 p-2 text-center min-w-[60px]',
                  'bg-emerald-50 border-emerald-200'
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
            <tr key={member.client_id} className="hover:bg-slate-50">
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
                    className="border border-slate-200 p-1 text-center bg-emerald-50/50"
                  >
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-8 p-0 hover:bg-slate-100"
                        >
                          {getStatusDisplay(status)}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-40 p-1">
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
```

---

## 2.4 Обновление компонента GroupsList

**Обновить файл:** `src/components/groups/GroupsList.tsx`

### Добавить импорты:
```tsx
import { Calendar } from 'lucide-react'
import { useState } from 'react'
import { GroupCalendarDialog } from './GroupCalendarDialog'
```

### Добавить state для диалога:
```tsx
const [calendarGroup, setCalendarGroup] = useState<Group | null>(null)
```

### Добавить кнопку календаря в карточку группы:

В блоке с кнопками действий добавить новую кнопку **перед** кнопкой редактирования:

```tsx
<div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
  {/* Новая кнопка календаря */}
  <Button 
    variant="ghost" 
    size="icon" 
    onClick={() => setCalendarGroup(group)}
    title="Календарь посещаемости"
  >
    <Calendar className="w-4 h-4" />
  </Button>
  <Button variant="ghost" size="icon" onClick={() => onEdit(group)}>
    <Pencil className="w-4 h-4" />
  </Button>
  {/* ... остальные кнопки ... */}
</div>
```

### Добавить диалог в конец компонента:

```tsx
return (
  <>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* ... карточки групп ... */}
    </div>

    {/* Диалог календаря */}
    <GroupCalendarDialog
      open={!!calendarGroup}
      onOpenChange={(open) => !open && setCalendarGroup(null)}
      group={calendarGroup}
    />
  </>
)
```

---

## 2.5 Полный обновлённый GroupsList.tsx

Для удобства — полный код компонента:

```tsx
import type { Group } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, User, Pencil, Trash2, ChevronRight, Calendar } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { GroupCalendarDialog } from './GroupCalendarDialog'

interface GroupsListProps {
  groups: Group[]
  onEdit: (group: Group) => void
  onDelete: (group: Group) => void
}

export function GroupsList({ groups, onEdit, onDelete }: GroupsListProps) {
  const navigate = useNavigate()
  const [calendarGroup, setCalendarGroup] = useState<Group | null>(null)

  if (groups.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
        <p>Нет групп</p>
        <p className="text-sm mt-1">Создайте первую группу</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => (
          <Card 
            key={group.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate(`/groups/${group.id}`)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{group.name}</CardTitle>
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  {/* Кнопка календаря */}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setCalendarGroup(group)}
                    title="Календарь посещаемости"
                  >
                    <Calendar className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(group)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => onDelete(group)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span>{group.member_count || 0} участников</span>
                </div>
                {group.trainer_name && (
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>{group.trainer_name}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center justify-between mt-4">
                <Badge variant="secondary">
                  {group.start_date || 'Дата не указана'}
                </Badge>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Диалог календаря */}
      <GroupCalendarDialog
        open={!!calendarGroup}
        onOpenChange={(open) => !open && setCalendarGroup(null)}
        group={calendarGroup}
      />
    </>
  )
}
```

---

## ✅ Критерии готовности этапа

1. Типы `GroupAttendanceMatrix` и `AttendanceStatus` добавлены в `types/index.ts`
2. Компонент `GroupCalendarDialog` создан и работает
3. Компонент `AttendanceCalendar` создан и работает
4. Иконка календаря отображается в карточке группы
5. При клике на иконку открывается диалог с календарём
6. Диалог показывает навигацию по месяцам
7. В таблице отображаются участники и дни занятий
