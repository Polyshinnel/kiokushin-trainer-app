# Этап 8: Главная страница (Dashboard)

**Срок: 1-2 дня**

---

## Цель этапа

Создать информативную главную страницу с виджетами: тренировки на сегодня, список должников, статистика и быстрые действия.

---

## Шаги выполнения

### 8.1 Создание виджета "Тренировки сегодня"

**Файл `src/components/dashboard/TodayLessons.tsx`:**
```typescript
import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, Users, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLessonsStore } from '@/stores/lessonsStore'
import { formatTime, cn } from '@/lib/utils'

export function TodayLessons() {
  const navigate = useNavigate()
  const { todayLessons, fetchTodayLessons } = useLessonsStore()

  useEffect(() => {
    fetchTodayLessons()
  }, [fetchTodayLessons])

  const now = new Date()
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  const isLessonNow = (startTime: string, endTime: string) => {
    return currentTime >= startTime && currentTime <= endTime
  }

  const isLessonPast = (endTime: string) => {
    return currentTime > endTime
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Тренировки сегодня
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/lessons')}>
          Все занятия
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {todayLessons.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Нет занятий на сегодня</p>
          </div>
        ) : (
          <div className="space-y-3">
            {todayLessons.map((lesson) => {
              const isNow = isLessonNow(lesson.start_time, lesson.end_time)
              const isPast = isLessonPast(lesson.end_time)
              
              return (
                <div
                  key={lesson.id}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg border',
                    isNow && 'border-primary bg-primary/5',
                    isPast && 'opacity-60',
                    !isNow && !isPast && 'border-slate-200'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-lg',
                      isNow ? 'bg-primary text-white' : 'bg-slate-100'
                    )}>
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium">{lesson.group_name}</p>
                      <p className="text-sm text-slate-500">
                        {formatTime(lesson.start_time)} — {formatTime(lesson.end_time)}
                        {lesson.trainer_name && ` • ${lesson.trainer_name}`}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isNow && (
                      <Badge className="bg-primary">Сейчас</Badge>
                    )}
                    <div className="flex items-center gap-1 text-sm text-slate-500">
                      <Users className="w-4 h-4" />
                      {lesson.attendance_count || 0}/{lesson.total_members || 0}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### 8.2 Создание виджета "Должники"

**Файл `src/components/dashboard/Debtors.tsx`:**
```typescript
import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CreditCard, ChevronRight, Phone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useClientsStore } from '@/stores/clientsStore'
import { formatDate } from '@/lib/utils'

export function Debtors() {
  const navigate = useNavigate()
  const { debtors, fetchDebtors, updatePaymentDate } = useClientsStore()

  useEffect(() => {
    fetchDebtors()
  }, [fetchDebtors])

  const handlePayment = async (clientId: number) => {
    const today = new Date().toISOString().split('T')[0]
    await updatePaymentDate(clientId, today)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          Должники
          {debtors.length > 0 && (
            <Badge variant="destructive">{debtors.length}</Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate('/clients')}>
          Все клиенты
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {debtors.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p>Нет должников</p>
            <p className="text-sm">Все клиенты оплатили</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {debtors.slice(0, 10).map((client) => {
              const daysSincePayment = client.last_payment_date
                ? Math.floor((Date.now() - new Date(client.last_payment_date).getTime()) / (1000 * 60 * 60 * 24))
                : null

              return (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                >
                  <div>
                    <p className="font-medium">{client.full_name}</p>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      {client.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {client.phone}
                        </span>
                      )}
                      <span>
                        {client.last_payment_date
                          ? `${daysSincePayment} дн. назад`
                          : 'Никогда не платил'
                        }
                      </span>
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePayment(client.id)}
                  >
                    <CreditCard className="w-4 h-4 mr-1" />
                    Оплатил
                  </Button>
                </div>
              )
            })}
            
            {debtors.length > 10 && (
              <p className="text-center text-sm text-slate-500 pt-2">
                И ещё {debtors.length - 10} должников...
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### 8.3 Создание карточек статистики

**Файл `src/components/dashboard/StatsCards.tsx`:**
```typescript
import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Users, UsersRound, Calendar, TrendingUp } from 'lucide-react'
import { clientsApi, groupsApi, lessonsApi } from '@/lib/api'

interface Stats {
  clientsCount: number
  groupsCount: number
  todayLessonsCount: number
  monthLessonsCount: number
}

export function StatsCards() {
  const [stats, setStats] = useState<Stats>({
    clientsCount: 0,
    groupsCount: 0,
    todayLessonsCount: 0,
    monthLessonsCount: 0
  })

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    const [clients, groups, todayLessons] = await Promise.all([
      clientsApi.getAll(),
      groupsApi.getAll(),
      lessonsApi.getTodayLessons()
    ])

    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    
    const monthLessons = await lessonsApi.getAll({
      startDate: startOfMonth.toISOString().split('T')[0],
      endDate: endOfMonth.toISOString().split('T')[0]
    })

    setStats({
      clientsCount: (clients as any[]).length,
      groupsCount: (groups as any[]).length,
      todayLessonsCount: (todayLessons as any[]).length,
      monthLessonsCount: (monthLessons as any[]).length
    })
  }

  const cards = [
    {
      title: 'Клиентов',
      value: stats.clientsCount,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Групп',
      value: stats.groupsCount,
      icon: UsersRound,
      color: 'text-green-500',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Занятий сегодня',
      value: stats.todayLessonsCount,
      icon: Calendar,
      color: 'text-purple-500',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Занятий в месяце',
      value: stats.monthLessonsCount,
      icon: TrendingUp,
      color: 'text-orange-500',
      bgColor: 'bg-orange-100'
    }
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-sm text-slate-500">{card.title}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

### 8.4 Создание быстрых действий

**Файл `src/components/dashboard/QuickActions.tsx`:**
```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { UserPlus, UsersRound, Calendar, Zap } from 'lucide-react'

export function QuickActions() {
  const navigate = useNavigate()

  const actions = [
    {
      label: 'Добавить клиента',
      icon: UserPlus,
      onClick: () => navigate('/clients?action=add'),
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      label: 'Создать группу',
      icon: UsersRound,
      onClick: () => navigate('/groups?action=add'),
      color: 'bg-green-500 hover:bg-green-600'
    },
    {
      label: 'Сгенерировать занятия',
      icon: Calendar,
      onClick: () => navigate('/lessons?action=generate'),
      color: 'bg-purple-500 hover:bg-purple-600'
    }
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Быстрые действия
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {actions.map((action) => (
            <Button
              key={action.label}
              className={`h-auto py-4 flex flex-col gap-2 text-white ${action.color}`}
              onClick={action.onClick}
            >
              <action.icon className="w-6 h-6" />
              <span className="text-sm">{action.label}</span>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

### 8.5 Обновление страницы Dashboard

**Файл `src/pages/Dashboard.tsx`:**
```typescript
import { Header } from '@/components/layout/Header'
import { StatsCards } from '@/components/dashboard/StatsCards'
import { TodayLessons } from '@/components/dashboard/TodayLessons'
import { Debtors } from '@/components/dashboard/Debtors'
import { QuickActions } from '@/components/dashboard/QuickActions'

export function Dashboard() {
  const today = new Date().toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })

  return (
    <div className="flex flex-col h-full">
      <Header 
        title="Главная" 
        subtitle={today.charAt(0).toUpperCase() + today.slice(1)} 
      />
      
      <div className="flex-1 p-6 overflow-auto">
        <div className="space-y-6">
          <StatsCards />
          
          <QuickActions />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TodayLessons />
            <Debtors />
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## Проверка успешности этапа

- [ ] Карточки статистики отображаются
- [ ] Количества актуальны
- [ ] Виджет "Тренировки сегодня" показывает занятия
- [ ] Текущее занятие подсвечивается
- [ ] Виджет "Должники" показывает список
- [ ] Кнопка "Оплатил" работает
- [ ] Быстрые действия ведут на нужные страницы

---

## Результат этапа

Информативная главная страница:
- Статистика клиентов, групп, занятий
- Расписание на сегодня с подсветкой текущего
- Список должников с быстрой оплатой
- Быстрые действия для частых операций

