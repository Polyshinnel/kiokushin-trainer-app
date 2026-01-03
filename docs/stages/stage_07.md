# Этап 7: Модуль "Занятия"

**Срок: 3-4 дня**

---

## Цель этапа

Создать модуль управления занятиями: список занятий, автогенерация по расписанию, календарь посещаемости, интерфейс отметки посещаемости.

---

## Шаги выполнения

### 7.1 Создание Zustand store для занятий

**Файл `src/stores/lessonsStore.ts`:**
```typescript
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

export const useLessonsStore = create<LessonsState>((set, get) => ({
  lessons: [],
  todayLessons: [],
  currentAttendance: [],
  isLoading: false,
  filters: {},

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
    get().fetchAttendance(lessonId)
  }
}))
```

### 7.2 Создание таблицы занятий

**Файл `src/components/lessons/LessonsTable.tsx`:**
```typescript
import { Lesson } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Users, Trash2, ClipboardList } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'

interface LessonsTableProps {
  lessons: Lesson[]
  onAttendance: (lesson: Lesson) => void
  onDelete: (lesson: Lesson) => void
}

export function LessonsTable({ lessons, onAttendance, onDelete }: LessonsTableProps) {
  if (lessons.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Нет занятий</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дата</TableHead>
          <TableHead>Время</TableHead>
          <TableHead>Группа</TableHead>
          <TableHead>Тренер</TableHead>
          <TableHead>Посещаемость</TableHead>
          <TableHead className="text-right">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lessons.map((lesson) => (
          <TableRow key={lesson.id}>
            <TableCell className="font-medium">
              {formatDate(lesson.lesson_date)}
            </TableCell>
            <TableCell>
              {formatTime(lesson.start_time)} — {formatTime(lesson.end_time)}
            </TableCell>
            <TableCell>{lesson.group_name}</TableCell>
            <TableCell>{lesson.trainer_name || '—'}</TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-slate-400" />
                <span>{lesson.attendance_count || 0} / {lesson.total_members || 0}</span>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Посещаемость"
                  onClick={() => onAttendance(lesson)}
                >
                  <ClipboardList className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500"
                  onClick={() => onDelete(lesson)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

### 7.3 Создание диалога генерации занятий

**Файл `src/components/lessons/GenerateLessonsDialog.tsx`:**
```typescript
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { groupsApi } from '@/lib/api'
import type { Group } from '@/types'

interface GenerateLessonsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerate: (groupId: number, startDate: string, endDate: string) => Promise<number>
}

export function GenerateLessonsDialog({ open, onOpenChange, onGenerate }: GenerateLessonsDialogProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [groupId, setGroupId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (open) {
      loadGroups()
      const today = new Date()
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
      setStartDate(today.toISOString().split('T')[0])
      setEndDate(nextMonth.toISOString().split('T')[0])
    }
  }, [open])

  const loadGroups = async () => {
    const groups = await groupsApi.getAll() as Group[]
    setGroups(groups)
  }

  const handleGenerate = async () => {
    if (!groupId || !startDate || !endDate) return
    
    setIsGenerating(true)
    try {
      const count = await onGenerate(parseInt(groupId), startDate, endDate)
      onOpenChange(false)
      return count
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Сгенерировать занятия</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Группа</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите группу" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id.toString()}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Дата начала</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Дата окончания</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <p className="text-sm text-slate-500">
            Занятия будут созданы согласно расписанию группы на выбранный период.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleGenerate} disabled={isGenerating || !groupId}>
            {isGenerating ? 'Генерация...' : 'Сгенерировать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### 7.4 Создание диалога посещаемости

**Файл `src/components/lessons/AttendanceDialog.tsx`:**
```typescript
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Check, X, ThermometerSun, HelpCircle } from 'lucide-react'
import { useLessonsStore } from '@/stores/lessonsStore'
import { formatDate, getAttendanceStatusText, getAttendanceStatusColor, cn } from '@/lib/utils'
import type { Lesson, AttendanceStatus } from '@/types'

interface AttendanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lesson: Lesson | null
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'present', label: 'Был', icon: <Check className="w-4 h-4" />, color: 'bg-green-500' },
  { value: 'absent', label: 'Отсутствовал', icon: <X className="w-4 h-4" />, color: 'bg-red-500' },
  { value: 'sick', label: 'Болеет', icon: <ThermometerSun className="w-4 h-4" />, color: 'bg-yellow-500' },
  { value: null, label: 'Не отмечен', icon: <HelpCircle className="w-4 h-4" />, color: 'bg-slate-300' },
]

export function AttendanceDialog({ open, onOpenChange, lesson }: AttendanceDialogProps) {
  const { currentAttendance, fetchAttendance, updateAttendance } = useLessonsStore()

  useEffect(() => {
    if (open && lesson) {
      fetchAttendance(lesson.id)
    }
  }, [open, lesson, fetchAttendance])

  if (!lesson) return null

  const handleStatusChange = async (clientId: number, status: AttendanceStatus) => {
    await updateAttendance(lesson.id, clientId, status)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Посещаемость — {lesson.group_name}
          </DialogTitle>
          <p className="text-sm text-slate-500">
            {formatDate(lesson.lesson_date)}, {lesson.start_time} — {lesson.end_time}
          </p>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {currentAttendance.length === 0 ? (
            <p className="text-center py-8 text-slate-500">
              Нет участников в группе
            </p>
          ) : (
            currentAttendance.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div>
                  <p className="font-medium">{record.client_name}</p>
                  <p className="text-sm text-slate-500">{record.client_phone || '—'}</p>
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Badge className={cn('mr-2', getAttendanceStatusColor(record.status))}>
                        {getAttendanceStatusText(record.status)}
                      </Badge>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1">
                    {STATUS_OPTIONS.map((option) => (
                      <Button
                        key={option.value ?? 'null'}
                        variant="ghost"
                        className="w-full justify-start gap-2"
                        onClick={() => handleStatusChange(record.client_id, option.value)}
                      >
                        <span className={cn('p-1 rounded text-white', option.color)}>
                          {option.icon}
                        </span>
                        {option.label}
                      </Button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### 7.5 Создание фильтров занятий

**Файл `src/components/lessons/LessonsFilters.tsx`:**
```typescript
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'
import { groupsApi } from '@/lib/api'
import type { Group } from '@/types'

interface LessonsFiltersProps {
  filters: {
    groupId?: number
    startDate?: string
    endDate?: string
  }
  onChange: (filters: any) => void
}

export function LessonsFilters({ filters, onChange }: LessonsFiltersProps) {
  const [groups, setGroups] = useState<Group[]>([])

  useEffect(() => {
    loadGroups()
  }, [])

  const loadGroups = async () => {
    const groups = await groupsApi.getAll() as Group[]
    setGroups(groups)
  }

  const clearFilters = () => {
    onChange({})
  }

  const hasFilters = filters.groupId || filters.startDate || filters.endDate

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div className="space-y-1">
        <Label className="text-xs">Группа</Label>
        <Select
          value={filters.groupId?.toString() || 'all'}
          onValueChange={(v) => onChange({ ...filters, groupId: v === 'all' ? undefined : parseInt(v) })}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Все группы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все группы</SelectItem>
            {groups.map((group) => (
              <SelectItem key={group.id} value={group.id.toString()}>
                {group.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">С даты</Label>
        <Input
          type="date"
          className="w-[160px]"
          value={filters.startDate || ''}
          onChange={(e) => onChange({ ...filters, startDate: e.target.value || undefined })}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">По дату</Label>
        <Input
          type="date"
          className="w-[160px]"
          value={filters.endDate || ''}
          onChange={(e) => onChange({ ...filters, endDate: e.target.value || undefined })}
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="w-4 h-4 mr-1" />
          Сбросить
        </Button>
      )}
    </div>
  )
}
```

### 7.6 Обновление страницы занятий

**Файл `src/pages/Lessons.tsx`:**
```typescript
import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Calendar as CalendarIcon } from 'lucide-react'
import { useLessonsStore } from '@/stores/lessonsStore'
import { LessonsTable } from '@/components/lessons/LessonsTable'
import { LessonsFilters } from '@/components/lessons/LessonsFilters'
import { GenerateLessonsDialog } from '@/components/lessons/GenerateLessonsDialog'
import { AttendanceDialog } from '@/components/lessons/AttendanceDialog'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { useToast } from '@/components/ui/use-toast'
import type { Lesson } from '@/types'

export function Lessons() {
  const { lessons, isLoading, filters, fetchLessons, setFilters, generateLessons, deleteLesson } = useLessonsStore()
  const { toast } = useToast()
  
  const [isGenerateOpen, setIsGenerateOpen] = useState(false)
  const [attendanceLesson, setAttendanceLesson] = useState<Lesson | null>(null)
  const [deletingLesson, setDeletingLesson] = useState<Lesson | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchLessons()
  }, [fetchLessons])

  const handleGenerate = async (groupId: number, startDate: string, endDate: string) => {
    const count = await generateLessons(groupId, startDate, endDate)
    toast({ title: `Создано ${count} занятий` })
    return count
  }

  const handleDelete = async () => {
    if (!deletingLesson) return
    setIsDeleting(true)
    try {
      await deleteLesson(deletingLesson.id)
      toast({ title: 'Занятие удалено' })
      setDeletingLesson(null)
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Занятия" subtitle={`Всего: ${lessons.length}`} />
      
      <div className="flex-1 p-6 overflow-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row gap-4 justify-between">
            <LessonsFilters filters={filters} onChange={setFilters} />
            <Button onClick={() => setIsGenerateOpen(true)}>
              <CalendarIcon className="w-4 h-4 mr-2" />
              Сгенерировать
            </Button>
          </div>
          
          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">Загрузка...</div>
            ) : (
              <LessonsTable
                lessons={lessons}
                onAttendance={setAttendanceLesson}
                onDelete={setDeletingLesson}
              />
            )}
          </div>
        </div>
      </div>

      <GenerateLessonsDialog
        open={isGenerateOpen}
        onOpenChange={setIsGenerateOpen}
        onGenerate={handleGenerate}
      />

      <AttendanceDialog
        open={!!attendanceLesson}
        onOpenChange={(open) => !open && setAttendanceLesson(null)}
        lesson={attendanceLesson}
      />

      <DeleteConfirmDialog
        open={!!deletingLesson}
        onOpenChange={(open) => !open && setDeletingLesson(null)}
        title="Удалить занятие?"
        description="Данные о посещаемости также будут удалены."
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
}
```

---

## Проверка успешности этапа

- [ ] Список занятий отображается
- [ ] Фильтрация по группе работает
- [ ] Фильтрация по датам работает
- [ ] Генерация занятий работает
- [ ] Отметка посещаемости работает
- [ ] Popup с выбором статуса работает
- [ ] Статистика посещаемости отображается
- [ ] Удаление занятий работает

---

## Результат этапа

Полнофункциональный модуль занятий:
- Таблица занятий с фильтрами
- Автогенерация по расписанию
- Интерфейс отметки посещаемости
- Статусы: Был / Отсутствовал / Болеет / Не отмечен

