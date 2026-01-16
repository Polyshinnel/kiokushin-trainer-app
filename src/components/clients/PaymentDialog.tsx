import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Client } from '@/types'

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client: Client | null
  onConfirm: (date: string) => Promise<void>
}

export function PaymentDialog({ open, onOpenChange, client, onConfirm }: PaymentDialogProps) {
  const [date, setDate] = useState<Date>(new Date())
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setDate(new Date())
    }
  }, [open])

  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      await onConfirm(date.toISOString().split('T')[0])
      onOpenChange(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Отметить оплату</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-slate-600 mb-4">
            Клиент: <strong>{client?.full_name}</strong>
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium">Дата начала периода</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP', { locale: ru }) : 'Выберите дату'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={isSubmitting}
            style={{ backgroundColor: '#0c194b', color: '#fff' }}
            onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = '#0f1f5a')}
            onMouseLeave={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = '#0c194b')}
          >
            {isSubmitting ? 'Сохранение...' : 'Подтвердить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

