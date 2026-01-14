# Этап 3: Интеграция с клиентами

**Срок:** 1 день

## Задачи

- [ ] Обновить `ClientForm.tsx` — добавить выбор абонемента
- [ ] Создать `AssignSubscriptionDialog.tsx`
- [ ] Создать `ClientSubscriptionCard.tsx`
- [ ] Показывать абонементы на странице клиента `ClientDetail.tsx`

---

## 3.1 Обновление формы клиента

**Обновить файл:** `src/components/clients/ClientForm.tsx`

Добавить выбор абонемента при создании/редактировании клиента:

```tsx
// Добавить импорты
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { subscriptionsApi } from '@/lib/api'
import type { Subscription } from '@/types'

// Добавить в форму состояние
const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
const [selectedSubscription, setSelectedSubscription] = useState<number | null>(null)

useEffect(() => {
  subscriptionsApi.getActive().then(setSubscriptions)
}, [])

// Добавить в JSX после полей родителей
<div className="space-y-2">
  <Label>Абонемент</Label>
  <Select 
    value={selectedSubscription?.toString() || ''} 
    onValueChange={(v) => setSelectedSubscription(parseInt(v))}
  >
    <SelectTrigger>
      <SelectValue placeholder="Выберите абонемент" />
    </SelectTrigger>
    <SelectContent>
      {subscriptions.map((sub) => (
        <SelectItem key={sub.id} value={sub.id.toString()}>
          {sub.name} — {sub.price.toLocaleString()} ₽
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

---

## 3.2 Диалог назначения абонемента

**Новый файл:** `src/components/subscriptions/AssignSubscriptionDialog.tsx`

```tsx
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { subscriptionsApi } from '@/lib/api'
import type { Subscription } from '@/types'

interface AssignSubscriptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: number
  clientName: string
  onSuccess: () => void
}

export function AssignSubscriptionDialog({ 
  open, 
  onOpenChange, 
  clientId, 
  clientName,
  onSuccess 
}: AssignSubscriptionDialogProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [selectedSubscription, setSelectedSubscription] = useState<string>('')
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [isPaid, setIsPaid] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      subscriptionsApi.getActive().then((data) => setSubscriptions(data as Subscription[]))
      setSelectedSubscription('')
      setStartDate(new Date())
      setIsPaid(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!selectedSubscription) return
    
    setIsSubmitting(true)
    try {
      await subscriptionsApi.assign({
        client_id: clientId,
        subscription_id: parseInt(selectedSubscription),
        start_date: format(startDate, 'yyyy-MM-dd'),
        is_paid: isPaid
      })
      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error('Error assigning subscription:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedSub = subscriptions.find(s => s.id.toString() === selectedSubscription)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Назначить абонемент</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-500">Клиент</p>
            <p className="font-medium">{clientName}</p>
          </div>

          <div className="space-y-2">
            <Label>Абонемент *</Label>
            <Select value={selectedSubscription} onValueChange={setSelectedSubscription}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите абонемент" />
              </SelectTrigger>
              <SelectContent>
                {subscriptions.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id.toString()}>
                    {sub.name} — {sub.price.toLocaleString()} ₽ / {sub.duration_days} дн.
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Дата начала</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'dd.MM.yyyy', { locale: ru }) : 'Выберите дату'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => date && setStartDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {selectedSub && (
            <div className="p-3 bg-slate-50 rounded-lg space-y-1">
              <p className="text-sm">
                <span className="text-slate-500">Срок действия:</span>{' '}
                {selectedSub.duration_days} дней
              </p>
              <p className="text-sm">
                <span className="text-slate-500">Посещений:</span>{' '}
                {selectedSub.visit_limit === 0 ? 'Безлимит' : selectedSub.visit_limit}
              </p>
              <p className="text-sm font-medium">
                <span className="text-slate-500">К оплате:</span>{' '}
                {selectedSub.price.toLocaleString()} ₽
              </p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input 
              type="checkbox" 
              id="isPaid" 
              checked={isPaid} 
              onChange={(e) => setIsPaid(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="isPaid" className="cursor-pointer">Абонемент оплачен</Label>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!selectedSubscription || isSubmitting}
            style={{ backgroundColor: '#0c194b', color: '#fff' }}
          >
            {isSubmitting ? 'Сохранение...' : 'Назначить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

## 3.3 Карточка абонемента клиента

**Новый файл:** `src/components/subscriptions/ClientSubscriptionCard.tsx`

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CreditCard, Calendar, CheckCircle, AlertCircle } from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'
import type { ClientSubscription } from '@/types'

interface ClientSubscriptionCardProps {
  subscription: ClientSubscription
  onMarkPaid?: (id: number) => void
}

export function ClientSubscriptionCard({ subscription, onMarkPaid }: ClientSubscriptionCardProps) {
  const endDate = parseISO(subscription.end_date)
  const daysLeft = differenceInDays(endDate, new Date())
  const isExpired = daysLeft < 0
  const isExpiringSoon = daysLeft >= 0 && daysLeft <= 7

  const visitsInfo = subscription.visits_total === 0 
    ? 'Безлимит'
    : `${subscription.visits_used} / ${subscription.visits_total}`

  return (
    <Card className={isExpired ? 'border-red-200 bg-red-50' : isExpiringSoon ? 'border-yellow-200 bg-yellow-50' : ''}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{subscription.subscription_name}</CardTitle>
          <Badge variant={subscription.is_paid ? 'default' : 'destructive'}>
            {subscription.is_paid ? 'Оплачен' : 'Не оплачен'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Calendar className="w-4 h-4" />
          <span>
            {format(parseISO(subscription.start_date), 'dd.MM.yyyy', { locale: ru })} — 
            {format(endDate, 'dd.MM.yyyy', { locale: ru })}
          </span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CheckCircle className="w-4 h-4" />
          <span>Посещений: {visitsInfo}</span>
        </div>

        {isExpired && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span>Абонемент истёк</span>
          </div>
        )}

        {isExpiringSoon && !isExpired && (
          <div className="flex items-center gap-2 text-sm text-yellow-600">
            <AlertCircle className="w-4 h-4" />
            <span>Осталось {daysLeft} дн.</span>
          </div>
        )}

        {!subscription.is_paid && onMarkPaid && (
          <Button 
            size="sm" 
            onClick={() => onMarkPaid(subscription.id)}
            style={{ backgroundColor: '#0c194b', color: '#fff' }}
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Отметить оплату
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 3.4 Интеграция в страницу клиента

**Обновить файл:** `src/pages/ClientDetail.tsx`

Добавить секцию с абонементами клиента:

```tsx
// Добавить импорты
import { ClientSubscriptionCard } from '@/components/subscriptions/ClientSubscriptionCard'
import { AssignSubscriptionDialog } from '@/components/subscriptions/AssignSubscriptionDialog'
import { subscriptionsApi } from '@/lib/api'
import type { ClientSubscription } from '@/types'

// Добавить состояния
const [clientSubscriptions, setClientSubscriptions] = useState<ClientSubscription[]>([])
const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)

// Загрузка абонементов клиента
useEffect(() => {
  if (client?.id) {
    subscriptionsApi.getClientSubscriptions(client.id)
      .then((data) => setClientSubscriptions(data as ClientSubscription[]))
  }
}, [client?.id])

const handleMarkPaid = async (subscriptionId: number) => {
  await subscriptionsApi.markAsPaid(subscriptionId)
  // Перезагрузить абонементы
  const data = await subscriptionsApi.getClientSubscriptions(client!.id)
  setClientSubscriptions(data as ClientSubscription[])
  toast.success('Оплата отмечена')
}

const handleSubscriptionAssigned = async () => {
  const data = await subscriptionsApi.getClientSubscriptions(client!.id)
  setClientSubscriptions(data as ClientSubscription[])
  toast.success('Абонемент назначен')
}

// Добавить в JSX секцию абонементов
<div className="mt-6">
  <div className="flex justify-between items-center mb-4">
    <h2 className="text-lg font-semibold">Абонементы</h2>
    <Button 
      size="sm" 
      onClick={() => setIsAssignDialogOpen(true)}
      style={{ backgroundColor: '#0c194b', color: '#fff' }}
    >
      <Plus className="w-4 h-4 mr-2" />
      Назначить
    </Button>
  </div>
  
  {clientSubscriptions.length === 0 ? (
    <p className="text-slate-500">Нет абонементов</p>
  ) : (
    <div className="grid gap-4 md:grid-cols-2">
      {clientSubscriptions.map((sub) => (
        <ClientSubscriptionCard 
          key={sub.id} 
          subscription={sub} 
          onMarkPaid={handleMarkPaid}
        />
      ))}
    </div>
  )}
</div>

<AssignSubscriptionDialog
  open={isAssignDialogOpen}
  onOpenChange={setIsAssignDialogOpen}
  clientId={client!.id}
  clientName={client!.full_name}
  onSuccess={handleSubscriptionAssigned}
/>
```

---

## ✅ Критерии готовности этапа

1. При создании клиента можно выбрать абонемент
2. На странице клиента отображаются все его абонементы
3. Можно назначить новый абонемент клиенту через диалог
4. Карточка абонемента показывает:
   - Название и статус оплаты
   - Даты действия
   - Количество посещений
   - Предупреждения об истечении
5. Можно отметить оплату абонемента

