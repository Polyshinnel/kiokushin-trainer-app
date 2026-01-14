# Этап 5: Дополнительные функции

**Срок:** 1 день

## Задачи

- [ ] Виджет на Dashboard — неоплаченные абонементы
- [ ] Виджет — истекающие абонементы
- [ ] Фильтрация клиентов по статусу абонемента

---

## 5.1 Виджет неоплаченных абонементов

**Новый файл:** `src/components/dashboard/UnpaidSubscriptions.tsx`

```tsx
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCard, AlertCircle } from 'lucide-react'
import { subscriptionsApi } from '@/lib/api'
import { toast } from 'sonner'
import type { ClientSubscription } from '@/types'

interface UnpaidSubscription extends ClientSubscription {
  client_name: string
}

export function UnpaidSubscriptions() {
  const [unpaid, setUnpaid] = useState<UnpaidSubscription[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const data = await subscriptionsApi.getUnpaid()
      setUnpaid(data as UnpaidSubscription[])
    } catch (error) {
      console.error('Error loading unpaid subscriptions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleMarkPaid = async (id: number) => {
    try {
      await subscriptionsApi.markAsPaid(id)
      toast.success('Оплата отмечена')
      loadData()
    } catch (error) {
      toast.error('Ошибка при отметке оплаты')
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Неоплаченные абонементы
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500">Загрузка...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={unpaid.length > 0 ? 'border-red-200' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Неоплаченные абонементы
          {unpaid.length > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {unpaid.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {unpaid.length === 0 ? (
          <p className="text-slate-500 text-sm">Все абонементы оплачены ✓</p>
        ) : (
          <ul className="space-y-3">
            {unpaid.slice(0, 5).map((sub) => (
              <li key={sub.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{sub.client_name}</p>
                  <p className="text-sm text-slate-500">
                    {sub.subscription_name} — {sub.subscription_price?.toLocaleString()} ₽
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleMarkPaid(sub.id)}
                >
                  Оплачено
                </Button>
              </li>
            ))}
            {unpaid.length > 5 && (
              <li className="text-sm text-slate-500">
                И ещё {unpaid.length - 5}...
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 5.2 Виджет истекающих абонементов

**Новый файл:** `src/components/dashboard/ExpiringSubscriptions.tsx`

```tsx
import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, AlertTriangle } from 'lucide-react'
import { subscriptionsApi } from '@/lib/api'
import { differenceInDays, parseISO, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import type { ClientSubscription } from '@/types'

interface ExpiringSubscription extends ClientSubscription {
  client_name: string
}

export function ExpiringSubscriptions() {
  const [expiring, setExpiring] = useState<ExpiringSubscription[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      try {
        const data = await subscriptionsApi.getExpiring(7)
        setExpiring(data as ExpiringSubscription[])
      } catch (error) {
        console.error('Error loading expiring subscriptions:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Истекающие абонементы
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500">Загрузка...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={expiring.length > 0 ? 'border-yellow-200' : ''}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Истекающие абонементы
          {expiring.length > 0 && (
            <span className="bg-yellow-500 text-white text-xs px-2 py-0.5 rounded-full">
              {expiring.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {expiring.length === 0 ? (
          <p className="text-slate-500 text-sm">Нет истекающих абонементов</p>
        ) : (
          <ul className="space-y-3">
            {expiring.slice(0, 5).map((sub) => {
              const daysLeft = differenceInDays(parseISO(sub.end_date), new Date())
              return (
                <li key={sub.id} className="flex items-center justify-between">
                  <div>
                    <Link 
                      to={`/clients/${sub.client_id}`}
                      className="font-medium hover:text-blue-600"
                    >
                      {sub.client_name}
                    </Link>
                    <p className="text-sm text-slate-500">
                      {sub.subscription_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-600">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {daysLeft === 0 ? 'Сегодня' : `${daysLeft} дн.`}
                    </span>
                  </div>
                </li>
              )
            })}
            {expiring.length > 5 && (
              <li className="text-sm text-slate-500">
                И ещё {expiring.length - 5}...
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
```

---

## 5.3 Добавление виджетов на Dashboard

**Обновить файл:** `src/pages/Dashboard.tsx`

```tsx
// Добавить импорты
import { UnpaidSubscriptions } from '@/components/dashboard/UnpaidSubscriptions'
import { ExpiringSubscriptions } from '@/components/dashboard/ExpiringSubscriptions'

// Добавить в JSX после существующих виджетов
<div className="grid gap-6 md:grid-cols-2 mt-6">
  <UnpaidSubscriptions />
  <ExpiringSubscriptions />
</div>
```

---

## 5.4 Фильтрация клиентов по статусу абонемента

**Обновить файл:** `src/pages/Clients.tsx`

Добавить фильтр по статусу абонемента:

```tsx
// Добавить состояние фильтра
const [subscriptionFilter, setSubscriptionFilter] = useState<'all' | 'active' | 'expired' | 'unpaid'>('all')

// Добавить в JSX
<Select value={subscriptionFilter} onValueChange={setSubscriptionFilter}>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="Статус абонемента" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">Все</SelectItem>
    <SelectItem value="active">Активный абонемент</SelectItem>
    <SelectItem value="expired">Истёк/нет абонемента</SelectItem>
    <SelectItem value="unpaid">Не оплачен</SelectItem>
  </SelectContent>
</Select>
```

### Серверная фильтрация

**Обновить файл:** `electron/database/queries/clients.ts`

```typescript
interface ClientsFilter {
  search?: string
  subscriptionStatus?: 'active' | 'expired' | 'unpaid'
}

getAll(filter?: ClientsFilter): Client[] {
  const db = getDatabase()
  let query = `
    SELECT c.*, 
      (SELECT cs.id FROM client_subscriptions cs 
       WHERE cs.client_id = c.id 
         AND cs.end_date >= date('now')
         AND cs.start_date <= date('now')
         AND (cs.visits_total = 0 OR cs.visits_used < cs.visits_total)
       LIMIT 1) as active_subscription_id,
      (SELECT cs.is_paid FROM client_subscriptions cs 
       WHERE cs.client_id = c.id 
         AND cs.end_date >= date('now')
         AND cs.start_date <= date('now')
       ORDER BY cs.end_date ASC
       LIMIT 1) as subscription_is_paid
    FROM clients c
    WHERE 1=1
  `
  
  const params: any[] = []

  if (filter?.search) {
    query += ` AND c.full_name LIKE ?`
    params.push(`%${filter.search}%`)
  }

  if (filter?.subscriptionStatus === 'active') {
    query += ` AND active_subscription_id IS NOT NULL AND subscription_is_paid = 1`
  } else if (filter?.subscriptionStatus === 'expired') {
    query += ` AND active_subscription_id IS NULL`
  } else if (filter?.subscriptionStatus === 'unpaid') {
    query += ` AND active_subscription_id IS NOT NULL AND subscription_is_paid = 0`
  }

  query += ` ORDER BY c.full_name`

  return db.prepare(query).all(...params) as Client[]
}
```

---

## 5.5 Статистика абонементов на Dashboard

Добавить карточку со статистикой абонементов в `StatsCards.tsx`:

```tsx
// Новая карточка статистики
interface SubscriptionStats {
  totalActive: number
  totalUnpaid: number
  totalExpiringSoon: number
  revenue: number
}

// Загрузка статистики
const loadSubscriptionStats = async (): Promise<SubscriptionStats> => {
  const [unpaid, expiring] = await Promise.all([
    subscriptionsApi.getUnpaid(),
    subscriptionsApi.getExpiring(7)
  ])
  
  return {
    totalActive: 0, // TODO: добавить запрос
    totalUnpaid: (unpaid as any[]).length,
    totalExpiringSoon: (expiring as any[]).length,
    revenue: (unpaid as any[]).reduce((sum, s) => sum + (s.subscription_price || 0), 0)
  }
}
```

---

## ✅ Критерии готовности этапа

1. На Dashboard отображается виджет неоплаченных абонементов
2. Можно отметить оплату прямо из виджета
3. На Dashboard отображается виджет истекающих абонементов
4. Клиенты кликабельны и ведут на страницу клиента
5. На странице клиентов работает фильтр по статусу абонемента
6. Фильтрация работает корректно для всех статусов

