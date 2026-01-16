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
  const outOfVisits = subscription.visits_total > 0 && subscription.visits_used >= subscription.visits_total
  const isSubscriptionPaid = subscription.is_paid && !isExpired && !outOfVisits

  const visitsInfo = subscription.visits_total === 0 
    ? 'Безлимит'
    : `${subscription.visits_used} / ${subscription.visits_total}`

  return (
    <Card className={isExpired ? 'border-red-200 bg-red-50' : isExpiringSoon ? 'border-yellow-200 bg-yellow-50' : ''}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{subscription.subscription_name}</CardTitle>
          <Badge variant={isSubscriptionPaid ? 'default' : 'destructive'}>
            {isSubscriptionPaid ? 'Оплачен' : 'Не оплачен'}
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

        {(isExpired || outOfVisits) && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span>{outOfVisits ? 'Лимит посещений исчерпан' : 'Абонемент истёк'}</span>
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

