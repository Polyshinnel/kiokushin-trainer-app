import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { CreditCard } from 'lucide-react'
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

