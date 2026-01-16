# План разработки календаря посещаемости группы

## Обзор

Данный документ описывает детальный план технической реализации функционала календаря посещаемости для групп в приложении Kentos Dojo. Календарь будет отображаться при нажатии на иконку календаря в карточке группы и позволит просматривать и редактировать посещаемость участников за выбранный месяц.

---

## 📋 Содержание

1. [Общее описание функционала](#1-общее-описание-функционала)
2. [Структура базы данных](#2-структура-базы-данных)
3. [Backend (Electron)](#3-backend-electron)
4. [Frontend компоненты](#4-frontend-компоненты)
5. [Дизайн интерфейса](#5-дизайн-интерфейса)
6. [Этапы реализации](#6-этапы-реализации)

---

## 1. Общее описание функционала

### 1.1 Требования

1. **Иконка календаря** — добавить в карточку группы (рядом с иконками редактирования и удаления)
2. **Диалог с календарём** — при нажатии открывается модальное окно
3. **Календарная сетка** — отображение месяца, дни с занятиями выделены зеленоватым цветом
4. **Список участников** — слева от календаря список всех участников группы
5. **Отметки посещаемости** — для каждого участника на каждый день занятия:
   - ✅ Был (present) — зелёный
   - ❌ Не был (absent) — красный  
   - 🤒 Болел (sick) — жёлтый

### 1.2 Макет интерфейса

```
┌──────────────────────────────────────────────────────────────────────┐
│  Календарь посещаемости — Группа "Дети 7-10 лет"         ◀ Янв 2026 ▶│
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Участники        │ Пн  │ Вт  │ Ср  │ Чт  │ Пт  │ Сб  │ Вс  │        │
│                   │  6  │  7  │  8  │  9  │ 10  │ 11  │ 12  │        │
│  ─────────────────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤        │
│  Иванов Иван      │  ✅ │     │  ✅ │     │  ✅ │     │     │        │
│  Петрова Мария    │  ✅ │     │  🤒 │     │  ✅ │     │     │        │
│  Сидоров Алексей  │  ❌ │     │  ✅ │     │  ✅ │     │     │        │
│  ...              │     │     │     │     │     │     │     │        │
│                                                                      │
│  Легенда: ✅ Был  ❌ Не был  🤒 Болел  [🟢] День занятия             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. Структура базы данных

### 2.1 Используемые существующие таблицы

Для реализации календаря посещаемости используются уже существующие таблицы:

**Таблица `lessons`** — занятия:
```sql
-- Уже существует
CREATE TABLE lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  lesson_date DATE NOT NULL,        -- Дата занятия
  start_time TEXT NOT NULL,         -- Время начала
  end_time TEXT NOT NULL,           -- Время окончания
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT DEFAULT 'pending',
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);
```

**Таблица `attendance`** — посещаемость:
```sql
-- Уже существует
CREATE TABLE attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  status TEXT CHECK (status IN ('present', 'absent', 'sick') OR status IS NULL),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sync_status TEXT DEFAULT 'pending',
  FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  UNIQUE(lesson_id, client_id)
);
```

**Таблица `group_members`** — участники группы:
```sql
-- Уже существует
CREATE TABLE group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  joined_at DATE DEFAULT CURRENT_DATE,
  sync_status TEXT DEFAULT 'pending',
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
  UNIQUE(group_id, client_id)
);
```

### 2.2 Новые индексы (опционально)

```sql
-- Для оптимизации выборки занятий за период
CREATE INDEX IF NOT EXISTS idx_lessons_group_date ON lessons(group_id, lesson_date);
```

---

## 3. Backend (Electron)

### 3.1 Новые запросы для календаря

**Обновить файл:** `electron/database/queries/lessons.ts`

```typescript
// Добавить новый метод для получения занятий группы за месяц
export const lessonQueries = {
  // ... существующие методы ...

  /**
   * Получить занятия группы за указанный месяц
   */
  getByGroupAndMonth(groupId: number, year: number, month: number): LessonWithDetails[] {
    const db = getDatabase()
    
    // Формируем даты начала и конца месяца
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    
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
      WHERE l.group_id = ? AND l.lesson_date BETWEEN ? AND ?
      ORDER BY l.lesson_date ASC, l.start_time ASC
    `).all(groupId, startDate, endDate) as LessonWithDetails[]
  },

  /**
   * Получить полную матрицу посещаемости группы за месяц
   * Возвращает: { lessons: [], members: [], attendance: { lessonId: { clientId: status } } }
   */
  getGroupAttendanceMatrix(groupId: number, year: number, month: number): {
    lessons: LessonWithDetails[]
    members: { client_id: number; client_name: string; client_phone: string | null }[]
    attendance: Record<number, Record<number, 'present' | 'absent' | 'sick' | null>>
  } {
    const db = getDatabase()
    
    // Получаем занятия за месяц
    const lessons = this.getByGroupAndMonth(groupId, year, month)
    
    // Получаем участников группы
    const members = db.prepare(`
      SELECT gm.client_id, c.full_name as client_name, c.phone as client_phone
      FROM group_members gm
      JOIN clients c ON c.id = gm.client_id
      WHERE gm.group_id = ?
      ORDER BY c.full_name
    `).all(groupId) as { client_id: number; client_name: string; client_phone: string | null }[]
    
    // Получаем все записи посещаемости за эти занятия
    const lessonIds = lessons.map(l => l.id)
    
    if (lessonIds.length === 0) {
      return { lessons, members, attendance: {} }
    }
    
    const placeholders = lessonIds.map(() => '?').join(',')
    const attendanceRecords = db.prepare(`
      SELECT lesson_id, client_id, status
      FROM attendance
      WHERE lesson_id IN (${placeholders})
    `).all(...lessonIds) as { lesson_id: number; client_id: number; status: 'present' | 'absent' | 'sick' | null }[]
    
    // Формируем матрицу посещаемости
    const attendance: Record<number, Record<number, 'present' | 'absent' | 'sick' | null>> = {}
    
    for (const record of attendanceRecords) {
      if (!attendance[record.lesson_id]) {
        attendance[record.lesson_id] = {}
      }
      attendance[record.lesson_id][record.client_id] = record.status
    }
    
    return { lessons, members, attendance }
  }
}
```

### 3.2 Новые IPC Handlers

**Обновить файл:** `electron/main.ts`

```typescript
// Добавить новые handlers в setupIpcHandlers():

// Calendar attendance
ipcMain.handle('db:lessons:getByGroupAndMonth', (_, groupId, year, month) => 
  lessonQueries.getByGroupAndMonth(groupId, year, month))
  
ipcMain.handle('db:lessons:getGroupAttendanceMatrix', (_, groupId, year, month) => 
  lessonQueries.getGroupAttendanceMatrix(groupId, year, month))
```

### 3.3 Обновление API функций

**Обновить файл:** `src/lib/api.ts`

```typescript
export const lessonsApi = {
  // ... существующие методы ...

  // Получить занятия группы за месяц
  getByGroupAndMonth: (groupId: number, year: number, month: number) =>
    window.electronAPI.db.query('lessons:getByGroupAndMonth', groupId, year, month),

  // Получить матрицу посещаемости группы за месяц
  getGroupAttendanceMatrix: (groupId: number, year: number, month: number) =>
    window.electronAPI.db.query('lessons:getGroupAttendanceMatrix', groupId, year, month),
}
```

---

## 4. Frontend компоненты

### 4.1 Структура новых файлов

```
src/
├── components/
│   └── groups/
│       ├── GroupsList.tsx              # ОБНОВИТЬ: добавить иконку календаря
│       ├── GroupCalendarDialog.tsx     # НОВЫЙ: диалог с календарём
│       └── AttendanceCalendar.tsx      # НОВЫЙ: компонент календарной сетки
```

### 4.2 Типы TypeScript

**Обновить файл:** `src/types/index.ts`

```typescript
// Добавить новые типы

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

### 4.3 Обновление компонента GroupsList

**Обновить файл:** `src/components/groups/GroupsList.tsx`

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

### 4.4 Компонент диалога календаря

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

### 4.5 Компонент календарной сетки

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
import { lessonsApi, attendanceApi } from '@/lib/api'
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

### 4.6 Обновление API для посещаемости

**Обновить файл:** `src/lib/api.ts`

```typescript
// Добавить/обновить attendanceApi
export const attendanceApi = {
  getByLesson: (lessonId: number) => 
    window.electronAPI.db.query('attendance:getByLesson', lessonId),
  
  updateStatus: (lessonId: number, clientId: number, status: AttendanceStatus) =>
    window.electronAPI.db.query('attendance:updateStatus', lessonId, clientId, status),
  
  getClientAttendance: (clientId: number, startDate?: string, endDate?: string) =>
    window.electronAPI.db.query('attendance:getClientAttendance', clientId, startDate, endDate),
}
```

---

## 5. Дизайн интерфейса

### 5.1 Цветовая схема

| Элемент | Цвет | Класс Tailwind |
|---------|------|----------------|
| День с занятием (фон) | Светло-изумрудный | `bg-emerald-50` |
| День с занятием (граница) | Изумрудный | `border-emerald-200` |
| Статус "Был" | Зелёный | `bg-green-100 text-green-600` |
| Статус "Не был" | Красный | `bg-red-100 text-red-600` |
| Статус "Болел" | Жёлтый | `bg-yellow-100 text-yellow-600` |
| Не отмечен | Серый | `bg-slate-100 text-slate-400` |
| Заголовок таблицы | Светло-серый | `bg-slate-50` |

### 5.2 Адаптивность

- **Desktop (>900px)**: Полная таблица со всеми колонками
- **Tablet (600-900px)**: Горизонтальная прокрутка таблицы
- **Mobile (<600px)**: Диалог на весь экран, горизонтальная прокрутка

### 5.3 UX особенности

1. **Sticky первая колонка** — при горизонтальной прокрутке имена участников остаются видимыми
2. **Подсветка дней занятий** — зеленоватый фон для быстрого визуального определения
3. **Popover для выбора статуса** — быстрое изменение статуса без перезагрузки
4. **Отображение времени занятия** — в заголовке каждого дня показывается время начала
5. **Навигация по месяцам** — кнопки "предыдущий/следующий месяц"

---

## 6. Этапы реализации

### Этап 1: Backend — запросы и API (2-3 часа)

- [ ] Добавить метод `getByGroupAndMonth` в `lessonQueries`
- [ ] Добавить метод `getGroupAttendanceMatrix` в `lessonQueries`
- [ ] Добавить IPC handlers в `main.ts`
- [ ] Добавить функции в `src/lib/api.ts`
- [ ] Протестировать запросы через DevTools

### Этап 2: Frontend — компоненты (3-4 часа)

- [ ] Создать `GroupCalendarDialog.tsx`
- [ ] Создать `AttendanceCalendar.tsx`
- [ ] Добавить типы в `src/types/index.ts`
- [ ] Обновить `GroupsList.tsx` — добавить иконку календаря

### Этап 3: Интеграция и тестирование (1-2 часа)

- [ ] Проверить открытие диалога по клику на иконку
- [ ] Проверить отображение занятий за разные месяцы
- [ ] Проверить изменение статуса посещаемости
- [ ] Проверить работу с пустыми данными (нет занятий, нет участников)

### Этап 4: Полировка UI (1-2 часа)

- [ ] Настроить цвета и отступы
- [ ] Добавить легенду
- [ ] Проверить адаптивность
- [ ] Добавить анимации переходов

---

## 📁 Итоговая структура файлов

```
electron/
├── database/
│   └── queries/
│       └── lessons.ts              # ОБНОВИТЬ: добавить методы для календаря
├── main.ts                         # ОБНОВИТЬ: добавить IPC handlers

src/
├── components/
│   └── groups/
│       ├── GroupsList.tsx          # ОБНОВИТЬ: добавить иконку календаря
│       ├── GroupCalendarDialog.tsx # НОВЫЙ: диалог календаря
│       └── AttendanceCalendar.tsx  # НОВЫЙ: компонент таблицы посещаемости
├── lib/
│   └── api.ts                      # ОБНОВИТЬ: добавить функции API
└── types/
    └── index.ts                    # ОБНОВИТЬ: добавить типы
```

---

## ✅ Критерии готовности

1. ✅ В карточке группы отображается иконка календаря
2. ✅ При нажатии открывается диалог с календарём посещаемости
3. ✅ Отображается список участников группы слева
4. ✅ Дни с занятиями выделены зеленоватым цветом
5. ✅ Можно переключаться между месяцами
6. ✅ Отображаются статусы посещаемости (был/не был/болел)
7. ✅ Можно изменить статус посещаемости кликом
8. ✅ Корректно работает с пустыми данными
9. ✅ Интерфейс адаптивен для разных размеров экрана

---

## 🔄 Возможные улучшения (на будущее)

1. **Экспорт в Excel** — выгрузка посещаемости за период
2. **Статистика** — процент посещаемости каждого участника
3. **Массовая отметка** — отметить всех как "присутствовал"
4. **Фильтрация участников** — поиск по имени
5. **Печать** — версия для печати
6. **Сравнение месяцев** — статистика по нескольким месяцам

