import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CreditCard, ChevronRight, Phone } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useClientsStore } from '@/stores/clientsStore'

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


