import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Clock, AlertTriangle } from 'lucide-react'
import { subscriptionsApi } from '@/lib/api'
import { differenceInDays, parseISO } from 'date-fns'
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

