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
    const [clientsResult, groups, todayLessons] = await Promise.all([
      clientsApi.getAll(),
      groupsApi.getAll(),
      lessonsApi.getTodayLessons()
    ])

    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    
    const monthLessonsResult = await lessonsApi.getAll({
      startDate: startOfMonth.toISOString().split('T')[0],
      endDate: endOfMonth.toISOString().split('T')[0]
    })

    const clients = clientsResult as { data?: any[]; total?: number }
    const monthLessons = monthLessonsResult as { data?: any[]; total?: number }

    setStats({
      clientsCount: clients.total ?? (clients.data?.length ?? 0),
      groupsCount: (groups as any[]).length,
      todayLessonsCount: (todayLessons as any[]).length,
      monthLessonsCount: monthLessons.total ?? (monthLessons.data?.length ?? 0)
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

