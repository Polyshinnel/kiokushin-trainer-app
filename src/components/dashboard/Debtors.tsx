import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CreditCard, ChevronRight, Phone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useClientsStore } from '@/stores/clientsStore'
import { subscriptionsApi } from '@/lib/api'

export function Debtors() {
  const navigate = useNavigate()
  const { debtors, fetchDebtors } = useClientsStore()

  useEffect(() => {
    fetchDebtors()
  }, [fetchDebtors])

  const handlePayment = async (clientId: number, subscriptionTypeId?: number | null) => {
    const today = new Date().toISOString().split('T')[0]
    if (!subscriptionTypeId) return
    await subscriptionsApi.assign({
      client_id: clientId,
      subscription_id: subscriptionTypeId,
      start_date: today,
      is_paid: true
    })
    await fetchDebtors()
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
              const hasSubscription = !!client.current_subscription_id
              const visitsTotal = client.current_subscription_visits_total ?? 0
              const visitsUsed = client.current_subscription_visits_used ?? 0
              const visitsText = visitsTotal > 0 ? `${visitsUsed} / ${visitsTotal}` : 'Безлимит'

              return (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
                >
                  <div>
                    <p className="font-medium">{client.full_name}</p>
                    <div className="flex flex-col gap-1 text-sm text-slate-600">
                      <div className="flex items-center gap-3">
                        {client.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {client.phone}
                          </span>
                        )}
                        <span>
                          {hasSubscription
                            ? client.current_subscription_name
                            : 'Нет абонемента'}
                        </span>
                      </div>
                      {hasSubscription && (
                        <>
                          <span>
                            Срок: {client.current_subscription_start_date} — {client.current_subscription_end_date}
                          </span>
                          <span>Посещено: {visitsText}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePayment(client.id, (client as any).current_subscription_type_id)}
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







