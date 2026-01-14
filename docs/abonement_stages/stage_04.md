# Этап 4: Учёт посещений и оплаты

**Срок:** 1 день

## Задачи

- [ ] Обновить `AttendanceDialog.tsx` — проверка оплаты
- [ ] Добавить индикаторы статуса оплаты
- [ ] Добавить уведомления об истекающих абонементах

---

## 4.1 Логика проверки оплаты посещения

При отметке посещения необходимо проверять:

1. Есть ли у клиента активный абонемент
2. Оплачен ли абонемент
3. Не истёк ли абонемент
4. Остались ли посещения (если лимит > 0)

---

## 4.2 Обновление диалога посещаемости

**Обновить файл:** `src/components/lessons/AttendanceDialog.tsx`

```tsx
// Добавить импорт
import { subscriptionsApi } from '@/lib/api'

// Добавить проверку при изменении статуса на "present"
const handleStatusChange = async (clientId: number, status: AttendanceStatus) => {
  if (status === 'present') {
    // Получить активный абонемент клиента
    const activeSubscription = await subscriptionsApi.getActiveClientSubscription(clientId)
    
    if (!activeSubscription) {
      toast.warning(`У клиента нет активного абонемента`)
    } else if (!activeSubscription.is_paid) {
      toast.warning(`Абонемент не оплачен`)
    } else {
      // Увеличить счётчик посещений
      await subscriptionsApi.incrementVisit(activeSubscription.id)
    }
  }
  
  await updateAttendance(lesson.id, clientId, status)
}
```

---

## 4.3 Индикация статуса оплаты в списке

Добавить визуальную индикацию статуса абонемента рядом с именем клиента:

```tsx
// Цветовые индикаторы:
// 🟢 Зелёный — абонемент оплачен и действует
// 🟡 Жёлтый — абонемент действует, но не оплачен
// 🔴 Красный — нет действующего абонемента

interface ClientWithSubscriptionStatus {
  id: number
  full_name: string
  subscriptionStatus: 'active' | 'unpaid' | 'none'
}

// Компонент индикатора
function SubscriptionIndicator({ status }: { status: 'active' | 'unpaid' | 'none' }) {
  const colors = {
    active: 'bg-green-500',
    unpaid: 'bg-yellow-500',
    none: 'bg-red-500'
  }
  
  const titles = {
    active: 'Абонемент активен и оплачен',
    unpaid: 'Абонемент не оплачен',
    none: 'Нет активного абонемента'
  }

  return (
    <span 
      className={`w-2 h-2 rounded-full ${colors[status]} inline-block`}
      title={titles[status]}
    />
  )
}
```

---

## 4.4 Загрузка статусов абонементов

```tsx
// В AttendanceDialog
const [subscriptionStatuses, setSubscriptionStatuses] = useState<Record<number, ClientSubscription | null>>({})

useEffect(() => {
  const loadStatuses = async () => {
    const statuses: Record<number, ClientSubscription | null> = {}
    
    for (const member of groupMembers) {
      const subscription = await subscriptionsApi.getActiveClientSubscription(member.id)
      statuses[member.id] = subscription || null
    }
    
    setSubscriptionStatuses(statuses)
  }
  
  if (open && groupMembers.length > 0) {
    loadStatuses()
  }
}, [open, groupMembers])

// Получение статуса
const getSubscriptionStatus = (clientId: number): 'active' | 'unpaid' | 'none' => {
  const sub = subscriptionStatuses[clientId]
  if (!sub) return 'none'
  if (!sub.is_paid) return 'unpaid'
  return 'active'
}
```

---

## 4.5 Отображение в списке посещаемости

```tsx
// В рендере списка клиентов
<div className="flex items-center gap-2">
  <SubscriptionIndicator status={getSubscriptionStatus(client.id)} />
  <span>{client.full_name}</span>
</div>
```

---

## 4.6 Уведомления об истекающих абонементах

При открытии диалога посещаемости показывать уведомление, если у кого-то из участников:
- Абонемент истекает в ближайшие 7 дней
- Абонемент не оплачен
- Нет активного абонемента

```tsx
useEffect(() => {
  const checkExpiringSubscriptions = async () => {
    const warnings: string[] = []
    
    for (const member of groupMembers) {
      const sub = subscriptionStatuses[member.id]
      
      if (!sub) {
        warnings.push(`${member.full_name}: нет абонемента`)
      } else if (!sub.is_paid) {
        warnings.push(`${member.full_name}: не оплачен`)
      } else {
        const daysLeft = differenceInDays(parseISO(sub.end_date), new Date())
        if (daysLeft <= 7 && daysLeft >= 0) {
          warnings.push(`${member.full_name}: истекает через ${daysLeft} дн.`)
        }
      }
    }
    
    if (warnings.length > 0) {
      toast.warning(
        <div>
          <p className="font-medium">Внимание!</p>
          <ul className="text-sm mt-1">
            {warnings.map((w, i) => <li key={i}>• {w}</li>)}
          </ul>
        </div>,
        { duration: 5000 }
      )
    }
  }
  
  if (open && Object.keys(subscriptionStatuses).length > 0) {
    checkExpiringSubscriptions()
  }
}, [open, subscriptionStatuses])
```

---

## 4.7 Блокировка отметки без абонемента (опционально)

Можно добавить опцию блокировки отметки посещения для клиентов без активного абонемента:

```tsx
const canMarkPresent = (clientId: number): boolean => {
  const status = getSubscriptionStatus(clientId)
  // Можно настроить: разрешать отметку с предупреждением или блокировать
  return status !== 'none'
}

// В обработчике
const handleStatusChange = async (clientId: number, status: AttendanceStatus) => {
  if (status === 'present' && !canMarkPresent(clientId)) {
    toast.error('Невозможно отметить посещение: нет активного абонемента')
    return
  }
  // ... остальная логика
}
```

---

## ✅ Критерии готовности этапа

1. При отметке посещения проверяется наличие активного абонемента
2. При отметке посещения показывается предупреждение, если абонемент не оплачен
3. Счётчик посещений автоматически увеличивается при отметке
4. В списке посещаемости отображаются индикаторы статуса абонемента
5. При открытии посещаемости показываются предупреждения об истекающих абонементах
6. Цветовая индикация понятна и информативна

