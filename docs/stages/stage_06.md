# Этап 6: Модуль "Группы"

**Срок: 2-3 дня**

---

## Цель этапа

Создать модуль управления группами: список групп, создание/редактирование, настройка расписания, назначение тренера, управление участниками.

---

## Шаги выполнения

### 6.1 Создание Zustand store для групп

**Файл `src/stores/groupsStore.ts`:**
```typescript
import { create } from 'zustand'
import { groupsApi } from '@/lib/api'
import type { Group, GroupSchedule, GroupMember } from '@/types'

interface GroupWithDetails extends Group {
  schedule: GroupSchedule[]
  members: GroupMember[]
}

interface GroupsState {
  groups: Group[]
  currentGroup: GroupWithDetails | null
  isLoading: boolean
  
  fetchGroups: () => Promise<void>
  fetchGroupById: (id: number) => Promise<GroupWithDetails>
  createGroup: (data: any) => Promise<Group>
  updateGroup: (id: number, data: any) => Promise<Group>
  deleteGroup: (id: number) => Promise<boolean>
  
  addSchedule: (groupId: number, data: any) => Promise<void>
  removeSchedule: (scheduleId: number) => Promise<void>
  
  addMember: (groupId: number, clientId: number) => Promise<void>
  removeMember: (groupId: number, clientId: number) => Promise<void>
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: [],
  currentGroup: null,
  isLoading: false,

  fetchGroups: async () => {
    set({ isLoading: true })
    try {
      const groups = await groupsApi.getAll() as Group[]
      set({ groups, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
    }
  },

  fetchGroupById: async (id) => {
    const group = await groupsApi.getById(id) as GroupWithDetails
    set({ currentGroup: group })
    return group
  },

  createGroup: async (data) => {
    const group = await groupsApi.create(data) as Group
    set((state) => ({ groups: [...state.groups, group] }))
    return group
  },

  updateGroup: async (id, data) => {
    const group = await groupsApi.update(id, data) as Group
    set((state) => ({
      groups: state.groups.map((g) => (g.id === id ? { ...g, ...group } : g))
    }))
    return group
  },

  deleteGroup: async (id) => {
    const success = await groupsApi.delete(id) as boolean
    if (success) {
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== id)
      }))
    }
    return success
  },

  addSchedule: async (groupId, data) => {
    await groupsApi.addSchedule(groupId, data)
    get().fetchGroupById(groupId)
  },

  removeSchedule: async (scheduleId) => {
    const currentGroup = get().currentGroup
    await groupsApi.removeSchedule(scheduleId)
    if (currentGroup) {
      get().fetchGroupById(currentGroup.id)
    }
  },

  addMember: async (groupId, clientId) => {
    await groupsApi.addMember(groupId, clientId)
    get().fetchGroupById(groupId)
    get().fetchGroups()
  },

  removeMember: async (groupId, clientId) => {
    await groupsApi.removeMember(groupId, clientId)
    get().fetchGroupById(groupId)
    get().fetchGroups()
  }
}))
```

### 6.2 Создание списка групп

**Файл `src/components/groups/GroupsList.tsx`:**
```typescript
import { Group } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, User, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface GroupsListProps {
  groups: Group[]
  onEdit: (group: Group) => void
  onDelete: (group: Group) => void
}

export function GroupsList({ groups, onEdit, onDelete }: GroupsListProps) {
  const navigate = useNavigate()

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
  )
}
```

### 6.3 Создание формы группы

**Файл `src/components/groups/GroupForm.tsx`:**
```typescript
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Group, Employee } from '@/types'

interface GroupFormData {
  name: string
  start_date: string
  trainer_id: string
}

interface GroupFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group?: Group | null
  employees: Employee[]
  onSubmit: (data: any) => Promise<void>
}

export function GroupForm({ open, onOpenChange, group, employees, onSubmit }: GroupFormProps) {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<GroupFormData>({
    defaultValues: {
      name: group?.name || '',
      start_date: group?.start_date || '',
      trainer_id: group?.trainer_id?.toString() || ''
    }
  })

  const trainerId = watch('trainer_id')

  const handleFormSubmit = async (data: GroupFormData) => {
    await onSubmit({
      name: data.name,
      start_date: data.start_date || undefined,
      trainer_id: data.trainer_id ? parseInt(data.trainer_id) : undefined
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {group ? 'Редактировать группу' : 'Создать группу'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название группы *</Label>
            <Input
              id="name"
              {...register('name', { required: 'Название обязательно' })}
              placeholder="Группа начинающих"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="start_date">Дата начала</Label>
            <Input
              id="start_date"
              type="date"
              {...register('start_date')}
            />
          </div>

          <div className="space-y-2">
            <Label>Тренер</Label>
            <Select
              value={trainerId}
              onValueChange={(value) => setValue('trainer_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите тренера" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Не назначен</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id.toString()}>
                    {employee.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

### 6.4 Создание редактора расписания

**Файл `src/components/groups/ScheduleEditor.tsx`:**
```typescript
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import { getDayName } from '@/lib/utils'
import type { GroupSchedule } from '@/types'

interface ScheduleEditorProps {
  schedule: GroupSchedule[]
  onAdd: (data: { day_of_week: number; start_time: string; end_time: string }) => Promise<void>
  onRemove: (scheduleId: number) => Promise<void>
}

const DAYS = [
  { value: 0, label: 'Понедельник' },
  { value: 1, label: 'Вторник' },
  { value: 2, label: 'Среда' },
  { value: 3, label: 'Четверг' },
  { value: 4, label: 'Пятница' },
  { value: 5, label: 'Суббота' },
  { value: 6, label: 'Воскресенье' },
]

export function ScheduleEditor({ schedule, onAdd, onRemove }: ScheduleEditorProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [newSlot, setNewSlot] = useState({
    day_of_week: '0',
    start_time: '18:00',
    end_time: '19:30'
  })

  const handleAdd = async () => {
    await onAdd({
      day_of_week: parseInt(newSlot.day_of_week),
      start_time: newSlot.start_time,
      end_time: newSlot.end_time
    })
    setIsAdding(false)
    setNewSlot({ day_of_week: '0', start_time: '18:00', end_time: '19:30' })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Расписание</h4>
        <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Добавить
        </Button>
      </div>

      {schedule.length === 0 && !isAdding && (
        <p className="text-sm text-slate-500">Расписание не задано</p>
      )}

      <div className="space-y-2">
        {schedule.map((slot) => (
          <div
            key={slot.id}
            className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
          >
            <div>
              <span className="font-medium">{getDayName(slot.day_of_week)}</span>
              <span className="text-slate-600 ml-2">
                {slot.start_time} — {slot.end_time}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-500"
              onClick={() => onRemove(slot.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}

        {isAdding && (
          <div className="p-4 border border-slate-200 rounded-lg space-y-3">
            <div className="space-y-2">
              <Label>День недели</Label>
              <Select
                value={newSlot.day_of_week}
                onValueChange={(v) => setNewSlot({ ...newSlot, day_of_week: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day) => (
                    <SelectItem key={day.value} value={day.value.toString()}>
                      {day.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Начало</Label>
                <Input
                  type="time"
                  value={newSlot.start_time}
                  onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Конец</Label>
                <Input
                  type="time"
                  value={newSlot.end_time}
                  onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setIsAdding(false)}>
                Отмена
              </Button>
              <Button size="sm" onClick={handleAdd}>
                Добавить
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

### 6.5 Создание компонента участников

**Файл `src/components/groups/MembersManager.tsx`:**
```typescript
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, UserMinus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { clientsApi } from '@/lib/api'
import type { GroupMember, Client } from '@/types'

interface MembersManagerProps {
  members: GroupMember[]
  onAdd: (clientId: number) => Promise<void>
  onRemove: (clientId: number) => Promise<void>
}

export function MembersManager({ members, onAdd, onRemove }: MembersManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [availableClients, setAvailableClients] = useState<Client[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (isDialogOpen) {
      loadClients()
    }
  }, [isDialogOpen])

  const loadClients = async () => {
    const clients = await clientsApi.getAll() as Client[]
    const memberIds = new Set(members.map(m => m.client_id))
    setAvailableClients(clients.filter(c => !memberIds.has(c.id)))
  }

  const filteredClients = availableClients.filter(c =>
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAddClient = async (clientId: number) => {
    await onAdd(clientId)
    setAvailableClients(prev => prev.filter(c => c.id !== clientId))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Участники ({members.length})</h4>
        <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Добавить
        </Button>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-slate-500">Нет участников</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ФИО</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>{member.client?.full_name}</TableCell>
                <TableCell>{member.client?.phone || '—'}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500"
                    onClick={() => onRemove(member.client_id)}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Добавить участника</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск клиента..."
                className="pl-10"
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {filteredClients.length === 0 ? (
                <p className="text-center py-4 text-slate-500">
                  Нет доступных клиентов
                </p>
              ) : (
                filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{client.full_name}</p>
                      <p className="text-sm text-slate-500">{client.phone}</p>
                    </div>
                    <Button size="sm" onClick={() => handleAddClient(client.id)}>
                      Добавить
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

### 6.6 Создание страницы детальной информации группы

**Файл `src/pages/GroupDetail.tsx`:**
```typescript
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, User } from 'lucide-react'
import { useGroupsStore } from '@/stores/groupsStore'
import { ScheduleEditor } from '@/components/groups/ScheduleEditor'
import { MembersManager } from '@/components/groups/MembersManager'
import { useToast } from '@/components/ui/use-toast'

export function GroupDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentGroup, fetchGroupById, addSchedule, removeSchedule, addMember, removeMember } = useGroupsStore()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (id) {
      setIsLoading(true)
      fetchGroupById(parseInt(id)).finally(() => setIsLoading(false))
    }
  }, [id, fetchGroupById])

  if (isLoading || !currentGroup) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title={currentGroup.name} subtitle="Информация о группе" />
      
      <div className="flex-1 p-6 overflow-auto">
        <Button variant="ghost" onClick={() => navigate('/groups')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к группам
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Дата начала</p>
                <p className="font-medium">{currentGroup.start_date || 'Не указана'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Тренер</p>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="font-medium">
                    {currentGroup.trainer?.full_name || 'Не назначен'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Расписание и участники</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ScheduleEditor
                schedule={currentGroup.schedule}
                onAdd={async (data) => {
                  await addSchedule(currentGroup.id, data)
                  toast({ title: 'Расписание добавлено' })
                }}
                onRemove={async (scheduleId) => {
                  await removeSchedule(scheduleId)
                  toast({ title: 'Расписание удалено' })
                }}
              />

              <hr />

              <MembersManager
                members={currentGroup.members}
                onAdd={async (clientId) => {
                  await addMember(currentGroup.id, clientId)
                  toast({ title: 'Участник добавлен' })
                }}
                onRemove={async (clientId) => {
                  await removeMember(currentGroup.id, clientId)
                  toast({ title: 'Участник удалён' })
                }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
```

### 6.7 Обновление маршрутов

**Обновить `src/App.tsx`:**
```typescript
import { GroupDetail } from './pages/GroupDetail'

// Добавить в Routes:
<Route path="groups/:id" element={<GroupDetail />} />
```

---

## Проверка успешности этапа

- [ ] Список групп отображается карточками
- [ ] Создание группы работает
- [ ] Назначение тренера работает
- [ ] Переход на страницу группы работает
- [ ] Добавление расписания работает
- [ ] Удаление расписания работает
- [ ] Добавление участников работает
- [ ] Удаление участников работает
- [ ] Поиск клиентов при добавлении работает

---

## Результат этапа

Полнофункциональный модуль групп:
- Карточное отображение групп
- Детальная страница группы
- Управление расписанием
- Управление участниками
- Назначение тренера

