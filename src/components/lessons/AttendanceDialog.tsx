import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Check, X, ThermometerSun, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { differenceInDays, parseISO } from 'date-fns'
import { useLessonsStore } from '@/stores/lessonsStore'
import { subscriptionsApi } from '@/lib/api'
import { formatDate, formatTime, getAttendanceStatusText, getAttendanceStatusColor, cn } from '@/lib/utils'
import type { Lesson, AttendanceStatus, ClientSubscription } from '@/types'

interface AttendanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  lesson: Lesson | null
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'present', label: 'Присутствовал', icon: <Check className="w-4 h-4" />, color: 'bg-green-500' },
  { value: 'absent', label: 'Отсутствовал', icon: <X className="w-4 h-4" />, color: 'bg-red-500' },
  { value: 'sick', label: 'Болеет', icon: <ThermometerSun className="w-4 h-4" />, color: 'bg-yellow-500' },
  { value: null, label: 'Не отмечен', icon: <HelpCircle className="w-4 h-4" />, color: 'bg-slate-300' },
]

// Компонент индикатора статуса абонемента
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

export function AttendanceDialog({ open, onOpenChange, lesson }: AttendanceDialogProps) {
  const { currentAttendance, fetchAttendance, updateAttendance } = useLessonsStore()
  const [subscriptionStatuses, setSubscriptionStatuses] = useState<Record<number, ClientSubscription | null>>({})
  const [search, setSearch] = useState('')
  const hasShownWarningRef = useRef(false)

  useEffect(() => {
    if (open && lesson) {
      fetchAttendance(lesson.id)
    }
  }, [open, lesson, fetchAttendance])

  // Загрузка статусов абонементов
  useEffect(() => {
    const loadStatuses = async () => {
      const statuses: Record<number, ClientSubscription | null> = {}
      
      for (const record of currentAttendance) {
        try {
          const subscription = await subscriptionsApi.getActiveClientSubscription(record.client_id) as ClientSubscription | null
          statuses[record.client_id] = subscription || null
        } catch (error) {
          console.error(`Error loading subscription for client ${record.client_id}:`, error)
          statuses[record.client_id] = null
        }
      }
      
      setSubscriptionStatuses(statuses)
      hasShownWarningRef.current = false // Сброс флага при загрузке новых статусов
    }
    
    if (open && currentAttendance.length > 0) {
      loadStatuses()
    }
  }, [open, currentAttendance])

  // Проверка истекающих абонементов
  useEffect(() => {
    const checkExpiringSubscriptions = async () => {
      if (hasShownWarningRef.current) return
      
      const warnings: string[] = []
      
      for (const record of currentAttendance) {
        const sub = subscriptionStatuses[record.client_id]
        
        if (!sub) {
          warnings.push(`${record.client_name}: нет абонемента`)
        } else if (!sub.is_paid) {
          warnings.push(`${record.client_name}: не оплачен`)
        } else {
          const endDate = parseISO(sub.end_date)
          const daysLeft = differenceInDays(endDate, new Date())
          if (daysLeft <= 7 && daysLeft >= 0) {
            warnings.push(`${record.client_name}: истекает через ${daysLeft} дн.`)
          }
        }
      }
      
      if (warnings.length > 0) {
        hasShownWarningRef.current = true
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
    
    if (open && Object.keys(subscriptionStatuses).length > 0 && currentAttendance.length > 0) {
      checkExpiringSubscriptions()
    }
  }, [open, subscriptionStatuses, currentAttendance])

  if (!lesson) return null

  // Получение статуса абонемента
  const getSubscriptionStatus = (clientId: number): 'active' | 'unpaid' | 'none' => {
    const sub = subscriptionStatuses[clientId]
    if (!sub) return 'none'
    if (!sub.is_paid) return 'unpaid'
    return 'active'
  }

  // Фильтрация списка по имени или телефону
  const normalizedSearch = search.trim().toLowerCase()
  const filteredAttendance = normalizedSearch
    ? currentAttendance.filter((record) =>
        (record.client_name ?? '').toLowerCase().includes(normalizedSearch) ||
        (record.client_phone?.toLowerCase() ?? '').includes(normalizedSearch)
      )
    : currentAttendance

  const handleStatusChange = async (clientId: number, status: AttendanceStatus) => {
    if (status === 'present') {
      // Получить активный абонемент клиента
      const activeSubscription = await subscriptionsApi.getActiveClientSubscription(clientId) as ClientSubscription | null
      
      if (!activeSubscription) {
        toast.warning(`У клиента нет активного абонемента`)
        return
      } else if (!activeSubscription.is_paid) {
        toast.warning(`Абонемент не оплачен`)
        return
      } else {
        // Увеличить счётчик посещений
        await subscriptionsApi.incrementVisit(activeSubscription.id)
        // Обновить статус абонемента для этого клиента
        const updatedSubscription = await subscriptionsApi.getActiveClientSubscription(clientId) as ClientSubscription | null
        setSubscriptionStatuses(prev => ({
          ...prev,
          [clientId]: updatedSubscription
        }))
      }
    }
    
    await updateAttendance(lesson.id, clientId, status)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[min(80vh,700px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Посещаемость — {lesson.group_name}
          </DialogTitle>
          <p className="text-sm text-slate-500">
            {formatDate(lesson.lesson_date)}, {formatTime(lesson.start_time)} — {formatTime(lesson.end_time)}
          </p>
        </DialogHeader>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по имени или телефону"
          className="mb-3"
        />

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {currentAttendance.length === 0 ? (
            <p className="text-center py-8 text-slate-500">
              Нет участников в группе
            </p>
          ) : filteredAttendance.length === 0 ? (
            <p className="text-center py-8 text-slate-500">
              Ничего не найдено
            </p>
          ) : (
            filteredAttendance.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <SubscriptionIndicator status={getSubscriptionStatus(record.client_id)} />
                  <div>
                    <p className="font-medium">{record.client_name}</p>
                    <p className="text-sm text-slate-500">{record.client_phone || '—'}</p>
                  </div>
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Badge className={cn('mr-2', getAttendanceStatusColor(record.status))}>
                        {getAttendanceStatusText(record.status)}
                      </Badge>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1">
                    {STATUS_OPTIONS.map((option) => (
                      <Button
                        key={option.value ?? 'null'}
                        variant="ghost"
                        className="w-full justify-start gap-2"
                        onClick={() => handleStatusChange(record.client_id, option.value)}
                      >
                        <span className={cn('p-1 rounded text-white', option.color)}>
                          {option.icon}
                        </span>
                        {option.label}
                      </Button>
                    ))}
                  </PopoverContent>
                </Popover>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

