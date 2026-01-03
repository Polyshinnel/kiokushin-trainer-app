# Этап 5: Модуль "Клиенты"

**Срок: 1-2 дня**

---

## Цель этапа

Создать модуль управления клиентами: список с поиском, добавление, редактирование, удаление, управление родителями и отметка оплаты.

---

## Шаги выполнения

### 5.1 Создание Zustand store для клиентов

**Файл `src/stores/clientsStore.ts`:**
```typescript
import { create } from 'zustand'
import { clientsApi } from '@/lib/api'
import type { Client } from '@/types'

interface ClientsState {
  clients: Client[]
  debtors: Client[]
  isLoading: boolean
  searchQuery: string
  
  fetchClients: () => Promise<void>
  fetchDebtors: (days?: number) => Promise<void>
  searchClients: (query: string) => Promise<void>
  setSearchQuery: (query: string) => void
  createClient: (data: any) => Promise<Client>
  updateClient: (id: number, data: any) => Promise<Client>
  updatePaymentDate: (id: number, date: string) => Promise<void>
  deleteClient: (id: number) => Promise<boolean>
}

export const useClientsStore = create<ClientsState>((set, get) => ({
  clients: [],
  debtors: [],
  isLoading: false,
  searchQuery: '',

  fetchClients: async () => {
    set({ isLoading: true })
    try {
      const clients = await clientsApi.getAll() as Client[]
      set({ clients, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
    }
  },

  fetchDebtors: async (days = 30) => {
    const debtors = await clientsApi.getDebtors(days) as Client[]
    set({ debtors })
  },

  searchClients: async (query: string) => {
    if (!query.trim()) {
      return get().fetchClients()
    }
    set({ isLoading: true })
    try {
      const clients = await clientsApi.search(query) as Client[]
      set({ clients, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },

  createClient: async (data) => {
    const client = await clientsApi.create(data) as Client
    set((state) => ({ clients: [...state.clients, client] }))
    return client
  },

  updateClient: async (id, data) => {
    const client = await clientsApi.update(id, data) as Client
    set((state) => ({
      clients: state.clients.map((c) => (c.id === id ? client : c))
    }))
    return client
  },

  updatePaymentDate: async (id, date) => {
    await clientsApi.updatePaymentDate(id, date)
    set((state) => ({
      clients: state.clients.map((c) => 
        c.id === id ? { ...c, last_payment_date: date } : c
      ),
      debtors: state.debtors.filter((c) => c.id !== id)
    }))
  },

  deleteClient: async (id) => {
    const success = await clientsApi.delete(id) as boolean
    if (success) {
      set((state) => ({
        clients: state.clients.filter((c) => c.id !== id),
        debtors: state.debtors.filter((c) => c.id !== id)
      }))
    }
    return success
  }
}))
```

### 5.2 Создание компонента поиска

**Файл `src/components/shared/SearchInput.tsx`:**
```typescript
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSearch: () => void
  placeholder?: string
}

export function SearchInput({ value, onChange, onSearch, placeholder = 'Поиск...' }: SearchInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch()
    }
  }

  return (
    <div className="relative flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="pl-10 pr-10"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => {
              onChange('')
              onSearch()
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      <Button onClick={onSearch}>Найти</Button>
    </div>
  )
}
```

### 5.3 Создание таблицы клиентов

**Файл `src/components/clients/ClientsTable.tsx`:**
```typescript
import { Client } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pencil, Trash2, CreditCard } from 'lucide-react'
import { calculateAge, formatPhone, formatDate } from '@/lib/utils'

interface ClientsTableProps {
  clients: Client[]
  onEdit: (client: Client) => void
  onDelete: (client: Client) => void
  onPayment: (client: Client) => void
}

export function ClientsTable({ clients, onEdit, onDelete, onPayment }: ClientsTableProps) {
  const isDebtor = (client: Client) => {
    if (!client.last_payment_date) return true
    const paymentDate = new Date(client.last_payment_date)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return paymentDate < thirtyDaysAgo
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Клиенты не найдены</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[250px]">ФИО</TableHead>
          <TableHead>Возраст</TableHead>
          <TableHead>Телефон</TableHead>
          <TableHead>Последняя оплата</TableHead>
          <TableHead className="text-right">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <TableRow key={client.id}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                {client.full_name}
                {isDebtor(client) && (
                  <Badge variant="destructive" className="text-xs">Долг</Badge>
                )}
              </div>
            </TableCell>
            <TableCell>{calculateAge(client.birth_year)}</TableCell>
            <TableCell>{formatPhone(client.phone)}</TableCell>
            <TableCell>
              {client.last_payment_date 
                ? formatDate(client.last_payment_date)
                : <span className="text-slate-400">Не оплачено</span>
              }
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Отметить оплату"
                  onClick={() => onPayment(client)}
                >
                  <CreditCard className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(client)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => onDelete(client)}
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

### 5.4 Создание формы клиента

**Файл `src/components/clients/ClientForm.tsx`:**
```typescript
import { useForm, useFieldArray } from 'react-hook-form'
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
import { Plus, Trash2 } from 'lucide-react'
import type { Client } from '@/types'

interface ClientFormData {
  full_name: string
  birth_year: string
  phone: string
  parents: { full_name: string; phone: string }[]
}

interface ClientFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: Client | null
  onSubmit: (data: any) => Promise<void>
}

export function ClientForm({ open, onOpenChange, client, onSubmit }: ClientFormProps) {
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClientFormData>({
    defaultValues: {
      full_name: client?.full_name || '',
      birth_year: client?.birth_year?.toString() || '',
      phone: client?.phone || '',
      parents: []
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parents'
  })

  const handleFormSubmit = async (data: ClientFormData) => {
    await onSubmit({
      full_name: data.full_name,
      birth_year: data.birth_year ? parseInt(data.birth_year) : undefined,
      phone: data.phone || undefined,
      parents: data.parents.filter(p => p.full_name.trim())
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {client ? 'Редактировать клиента' : 'Добавить клиента'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">ФИО клиента *</Label>
            <Input
              id="full_name"
              {...register('full_name', { required: 'ФИО обязательно' })}
              placeholder="Петров Пётр Петрович"
            />
            {errors.full_name && (
              <p className="text-sm text-red-500">{errors.full_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birth_year">Год рождения</Label>
              <Input
                id="birth_year"
                type="number"
                {...register('birth_year')}
                placeholder="2010"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Родители</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ full_name: '', phone: '' })}
              >
                <Plus className="w-4 h-4 mr-1" />
                Добавить
              </Button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-start p-3 bg-slate-50 rounded-lg">
                <div className="flex-1 space-y-2">
                  <Input
                    {...register(`parents.${index}.full_name`)}
                    placeholder="ФИО родителя"
                  />
                  <Input
                    {...register(`parents.${index}.phone`)}
                    placeholder="Телефон родителя"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-red-500"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
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

### 5.5 Создание диалога оплаты

**Файл `src/components/clients/PaymentDialog.tsx`:**
```typescript
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Client } from '@/types'

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client | null
  onConfirm: (date: string) => Promise<void>
}

export function PaymentDialog({ open, onOpenChange, client, onConfirm }: PaymentDialogProps) {
  const [date, setDate] = useState<Date>(new Date())
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      await onConfirm(date.toISOString().split('T')[0])
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Отметить оплату</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-slate-600 mb-4">
            Клиент: <strong>{client?.full_name}</strong>
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">Дата оплаты</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP', { locale: ru }) : 'Выберите дату'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? 'Сохранение...' : 'Подтвердить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### 5.6 Обновление страницы клиентов

**Файл `src/pages/Clients.tsx`:**
```typescript
import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useClientsStore } from '@/stores/clientsStore'
import { ClientsTable } from '@/components/clients/ClientsTable'
import { ClientForm } from '@/components/clients/ClientForm'
import { PaymentDialog } from '@/components/clients/PaymentDialog'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { SearchInput } from '@/components/shared/SearchInput'
import { useToast } from '@/components/ui/use-toast'
import type { Client } from '@/types'

export function Clients() {
  const { 
    clients, isLoading, searchQuery,
    fetchClients, searchClients, setSearchQuery,
    createClient, updateClient, updatePaymentDate, deleteClient 
  } = useClientsStore()
  const { toast } = useToast()
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [payingClient, setPayingClient] = useState<Client | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const handleSearch = () => {
    searchClients(searchQuery)
  }

  const handleCreate = () => {
    setEditingClient(null)
    setIsFormOpen(true)
  }

  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setIsFormOpen(true)
  }

  const handleSubmit = async (data: any) => {
    try {
      if (editingClient) {
        await updateClient(editingClient.id, data)
        toast({ title: 'Клиент обновлён' })
      } else {
        await createClient(data)
        toast({ title: 'Клиент добавлен' })
      }
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' })
    }
  }

  const handlePayment = async (date: string) => {
    if (!payingClient) return
    try {
      await updatePaymentDate(payingClient.id, date)
      toast({ title: 'Оплата отмечена' })
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deletingClient) return
    setIsDeleting(true)
    try {
      await deleteClient(deletingClient.id)
      toast({ title: 'Клиент удалён' })
      setDeletingClient(null)
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Клиенты" subtitle={`Всего: ${clients.length}`} />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex-1 max-w-md">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                onSearch={handleSearch}
                placeholder="Поиск по ФИО или телефону..."
              />
            </div>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </div>
          
          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">Загрузка...</div>
            ) : (
              <ClientsTable
                clients={clients}
                onEdit={handleEdit}
                onDelete={setDeletingClient}
                onPayment={setPayingClient}
              />
            )}
          </div>
        </div>
      </div>

      <ClientForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        client={editingClient}
        onSubmit={handleSubmit}
      />

      <PaymentDialog
        open={!!payingClient}
        onOpenChange={(open) => !open && setPayingClient(null)}
        client={payingClient}
        onConfirm={handlePayment}
      />

      <DeleteConfirmDialog
        open={!!deletingClient}
        onOpenChange={(open) => !open && setDeletingClient(null)}
        title="Удалить клиента?"
        description={`Вы уверены, что хотите удалить ${deletingClient?.full_name}? Все связанные данные будут удалены.`}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
}
```

---

## Проверка успешности этапа

- [ ] Список клиентов отображается
- [ ] Поиск работает по ФИО и телефону
- [ ] Добавление клиента с родителями работает
- [ ] Редактирование клиента работает
- [ ] Диалог оплаты открывается
- [ ] Оплата отмечается
- [ ] Индикатор "Долг" показывается
- [ ] Удаление с подтверждением работает

---

## Результат этапа

Полнофункциональный модуль клиентов:
- Поиск по ФИО и телефону
- CRUD операции
- Управление родителями
- Отметка даты оплаты
- Индикация должников

