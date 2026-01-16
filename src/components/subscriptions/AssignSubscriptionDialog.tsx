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

