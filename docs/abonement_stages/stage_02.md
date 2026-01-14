# Этап 2: Frontend — Страница абонементов

**Срок:** 1 день

## Задачи

- [ ] Создать типы в `types/index.ts`
- [ ] Создать `subscriptionsApi` в `api.ts`
- [ ] Создать `subscriptionsStore.ts`
- [ ] Создать страницу `Subscriptions.tsx`
- [ ] Создать компоненты:
  - [ ] `SubscriptionsTable.tsx`
  - [ ] `SubscriptionForm.tsx`
- [ ] Добавить роут в App.tsx
- [ ] Добавить пункт меню в Sidebar

---

## 2.1 Типы TypeScript

**Обновить файл:** `src/types/index.ts`

```typescript
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
```

---

## 2.2 API функции

**Обновить файл:** `src/lib/api.ts`

```typescript
export const subscriptionsApi = {
  getAll: () => window.electronAPI.db.query('subscriptions:getAll'),
  getActive: () => window.electronAPI.db.query('subscriptions:getActive'),
  getById: (id: number) => window.electronAPI.db.query('subscriptions:getById', id),
  create: (data: any) => window.electronAPI.db.query('subscriptions:create', data),
  update: (id: number, data: any) => window.electronAPI.db.query('subscriptions:update', id, data),
  delete: (id: number) => window.electronAPI.db.query('subscriptions:delete', id),
  
  // Client subscriptions
  getClientSubscriptions: (clientId: number) => 
    window.electronAPI.db.query('subscriptions:getClientSubscriptions', clientId),
  getActiveClientSubscription: (clientId: number) => 
    window.electronAPI.db.query('subscriptions:getActiveClientSubscription', clientId),
  assign: (data: any) => window.electronAPI.db.query('subscriptions:assign', data),
  markAsPaid: (id: number, date?: string) => 
    window.electronAPI.db.query('subscriptions:markAsPaid', id, date),
  incrementVisit: (id: number) => window.electronAPI.db.query('subscriptions:incrementVisit', id),
  removeClientSubscription: (id: number) => 
    window.electronAPI.db.query('subscriptions:removeClientSubscription', id),
  getUnpaid: () => window.electronAPI.db.query('subscriptions:getUnpaid'),
  getExpiring: (days?: number) => window.electronAPI.db.query('subscriptions:getExpiring', days)
}
```

---

## 2.3 Zustand Store

**Новый файл:** `src/stores/subscriptionsStore.ts`

```typescript
import { create } from 'zustand'
import { subscriptionsApi } from '@/lib/api'
import type { Subscription, ClientSubscription } from '@/types'

interface SubscriptionsState {
  subscriptions: Subscription[]
  isLoading: boolean
  
  fetchSubscriptions: () => Promise<void>
  createSubscription: (data: any) => Promise<Subscription>
  updateSubscription: (id: number, data: any) => Promise<Subscription>
  deleteSubscription: (id: number) => Promise<boolean>
}

export const useSubscriptionsStore = create<SubscriptionsState>((set, get) => ({
  subscriptions: [],
  isLoading: false,

  fetchSubscriptions: async () => {
    set({ isLoading: true })
    try {
      const subscriptions = await subscriptionsApi.getAll() as Subscription[]
      set({ subscriptions, isLoading: false })
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
      set({ isLoading: false })
    }
  },

  createSubscription: async (data) => {
    const subscription = await subscriptionsApi.create(data) as Subscription
    set((state) => ({ subscriptions: [...state.subscriptions, subscription] }))
    return subscription
  },

  updateSubscription: async (id, data) => {
    const subscription = await subscriptionsApi.update(id, data) as Subscription
    set((state) => ({
      subscriptions: state.subscriptions.map((s) => (s.id === id ? subscription : s))
    }))
    return subscription
  },

  deleteSubscription: async (id) => {
    const success = await subscriptionsApi.delete(id) as boolean
    if (success) {
      set((state) => ({
        subscriptions: state.subscriptions.filter((s) => s.id !== id)
      }))
    }
    return success
  }
}))
```

---

## 2.4 Страница списка абонементов

**Новый файл:** `src/pages/Subscriptions.tsx`

```tsx
import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useSubscriptionsStore } from '@/stores/subscriptionsStore'
import { SubscriptionsTable } from '@/components/subscriptions/SubscriptionsTable'
import { SubscriptionForm } from '@/components/subscriptions/SubscriptionForm'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { toast } from 'sonner'
import type { Subscription } from '@/types'

export function Subscriptions() {
  const { subscriptions, isLoading, fetchSubscriptions, createSubscription, updateSubscription, deleteSubscription } = useSubscriptionsStore()
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null)
  const [deletingSubscription, setDeletingSubscription] = useState<Subscription | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  const handleCreate = () => {
    setEditingSubscription(null)
    setIsFormOpen(true)
  }

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription)
    setIsFormOpen(true)
  }

  const handleSubmit = async (data: any) => {
    try {
      if (editingSubscription) {
        await updateSubscription(editingSubscription.id, data)
        toast.success('Абонемент обновлён')
      } else {
        await createSubscription(data)
        toast.success('Абонемент создан')
      }
      setIsFormOpen(false)
    } catch (error) {
      toast.error('Ошибка сохранения')
    }
  }

  const handleDelete = async () => {
    if (!deletingSubscription) return
    setIsDeleting(true)
    try {
      await deleteSubscription(deletingSubscription.id)
      toast.success('Абонемент удалён')
      setDeletingSubscription(null)
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Абонементы" subtitle={`Всего: ${subscriptions.length}`} />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex justify-end">
            <Button 
              onClick={handleCreate}
              style={{ backgroundColor: '#0c194b', color: '#fff' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </div>
          
          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">Загрузка...</div>
            ) : (
              <SubscriptionsTable
                subscriptions={subscriptions}
                onEdit={handleEdit}
                onDelete={setDeletingSubscription}
              />
            )}
          </div>
        </div>
      </div>

      <SubscriptionForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        subscription={editingSubscription}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmDialog
        open={!!deletingSubscription}
        onOpenChange={(open) => !open && setDeletingSubscription(null)}
        title="Удалить абонемент?"
        description={`Вы уверены, что хотите удалить "${deletingSubscription?.name}"?`}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
}
```

---

## 2.5 Таблица абонементов

**Новый файл:** `src/components/subscriptions/SubscriptionsTable.tsx`

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2 } from 'lucide-react'
import type { Subscription } from '@/types'

interface SubscriptionsTableProps {
  subscriptions: Subscription[]
  onEdit: (subscription: Subscription) => void
  onDelete: (subscription: Subscription) => void
}

export function SubscriptionsTable({ subscriptions, onEdit, onDelete }: SubscriptionsTableProps) {
  const formatPrice = (price: number) => `${price.toLocaleString()} ₽`
  const formatDuration = (days: number) => {
    if (days === 30) return '1 месяц'
    if (days === 90) return '3 месяца'
    if (days === 180) return '6 месяцев'
    if (days === 365) return '1 год'
    return `${days} дн.`
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Название</TableHead>
          <TableHead>Цена</TableHead>
          <TableHead>Срок действия</TableHead>
          <TableHead>Посещений</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead className="w-[100px]">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-slate-500">
              Нет абонементов
            </TableCell>
          </TableRow>
        ) : (
          subscriptions.map((subscription) => (
            <TableRow key={subscription.id}>
              <TableCell className="font-medium">{subscription.name}</TableCell>
              <TableCell>{formatPrice(subscription.price)}</TableCell>
              <TableCell>{formatDuration(subscription.duration_days)}</TableCell>
              <TableCell>
                {subscription.visit_limit === 0 ? 'Безлимит' : subscription.visit_limit}
              </TableCell>
              <TableCell>
                <Badge variant={subscription.is_active ? 'default' : 'secondary'}>
                  {subscription.is_active ? 'Активен' : 'Неактивен'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(subscription)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => onDelete(subscription)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}
```

---

## 2.6 Форма создания/редактирования абонемента

**Новый файл:** `src/components/subscriptions/SubscriptionForm.tsx`

```tsx
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Subscription } from '@/types'

interface SubscriptionFormData {
  name: string
  price: string
  duration_days: string
  visit_limit: string
}

interface SubscriptionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription?: Subscription | null
  onSubmit: (data: any) => Promise<void>
}

export function SubscriptionForm({ open, onOpenChange, subscription, onSubmit }: SubscriptionFormProps) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SubscriptionFormData>()

  useEffect(() => {
    if (open && subscription) {
      reset({
        name: subscription.name,
        price: subscription.price.toString(),
        duration_days: subscription.duration_days.toString(),
        visit_limit: subscription.visit_limit.toString()
      })
    } else if (open) {
      reset({ name: '', price: '', duration_days: '30', visit_limit: '0' })
    }
  }, [open, subscription, reset])

  const handleFormSubmit = async (data: SubscriptionFormData) => {
    await onSubmit({
      name: data.name,
      price: parseFloat(data.price),
      duration_days: parseInt(data.duration_days),
      visit_limit: parseInt(data.visit_limit) || 0
    })
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            {subscription ? 'Редактировать абонемент' : 'Создать абонемент'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название *</Label>
            <Input
              id="name"
              {...register('name', { required: 'Название обязательно' })}
              placeholder="Стандартный"
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Цена (₽) *</Label>
              <Input
                id="price"
                type="number"
                {...register('price', { required: 'Цена обязательна', min: 0 })}
                placeholder="3500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration_days">Срок (дней) *</Label>
              <Input
                id="duration_days"
                type="number"
                {...register('duration_days', { required: true, min: 1 })}
                placeholder="30"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit_limit">Количество посещений</Label>
            <Input
              id="visit_limit"
              type="number"
              {...register('visit_limit')}
              placeholder="0 = безлимит"
            />
            <p className="text-xs text-slate-500">0 — неограниченное количество посещений</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              style={{ backgroundColor: '#0c194b', color: '#fff' }}
            >
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 2.7 Роутинг и навигация

### Добавить роут в App.tsx

```tsx
import { Subscriptions } from '@/pages/Subscriptions'

// В роутах
<Route path="/subscriptions" element={<Subscriptions />} />
```

### Добавить пункт меню в Sidebar

```tsx
// Добавить иконку
import { CreditCard } from 'lucide-react'

// Добавить в массив навигации
{
  name: 'Абонементы',
  href: '/subscriptions',
  icon: CreditCard
}
```

---

## ✅ Критерии готовности этапа

1. Страница абонементов открывается по маршруту `/subscriptions`
2. Пункт меню "Абонементы" отображается в боковом меню
3. Можно создавать новые абонементы через форму
4. Можно редактировать существующие абонементы
5. Можно удалять абонементы (с проверкой на наличие активных подписок)
6. Таблица корректно отображает все поля абонементов

