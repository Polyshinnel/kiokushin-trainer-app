import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { clientsApi, attendanceApi, subscriptionsApi } from '@/lib/api'
import { calculateAge, formatPhone, formatDate } from '@/lib/utils'
import { ClientSubscriptionCard } from '@/components/subscriptions/ClientSubscriptionCard'
import { AssignSubscriptionDialog } from '@/components/subscriptions/AssignSubscriptionDialog'
import type { ClientSubscription } from '@/types'

interface ClientWithParents {
  id: number
  full_name: string
  birth_date: string | null
  birth_year: number | null
  phone: string | null
  last_payment_date: string | null
  doc_type: 'passport' | 'certificate' | null
  doc_series: string | null
  doc_number: string | null
  doc_issued_by: string | null
  doc_issued_date: string | null
  home_address: string | null
  workplace: string | null
  created_at: string
  updated_at: string
  sync_status: string
  parents?: Array<{
    id: number
    full_name: string
    phone: string | null
  }>
}

interface AttendanceRecord {
  id: number
  lesson_id: number
  client_id: number
  status: 'present' | 'absent' | 'sick' | null
  lesson_date: string
  group_name: string
  start_time: string
  end_time: string
}

export function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [clientData, setClientData] = useState<ClientWithParents | null>(null)
  const [, setAttendance] = useState<AttendanceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [totalHours, setTotalHours] = useState(0)
  const [lastVisitDate, setLastVisitDate] = useState<string | null>(null)
  const [clientSubscriptions, setClientSubscriptions] = useState<ClientSubscription[]>([])
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const currentSubscription = clientSubscriptions.length > 0 ? clientSubscriptions[0] : null

  useEffect(() => {
    if (id) {
      loadClientData()
      loadLastVisit()
      loadClientSubscriptions()
    }
  }, [id])

  const loadClientSubscriptions = async () => {
    if (!id) return
    try {
      const data = await subscriptionsApi.getClientSubscriptions(parseInt(id))
      setClientSubscriptions(data as ClientSubscription[])
    } catch (error) {
      console.error('Error loading client subscriptions:', error)
    }
  }

  const handleMarkPaid = async (subscriptionId: number) => {
    try {
      await subscriptionsApi.markAsPaid(subscriptionId)
      await loadClientSubscriptions()
      toast.success('Оплата отмечена')
    } catch (error) {
      console.error('Error marking subscription as paid:', error)
      toast.error('Ошибка при отметке оплаты')
    }
  }

  const handleSubscriptionAssigned = async () => {
    await loadClientSubscriptions()
    toast.success('Абонемент назначен')
  }

  useEffect(() => {
    if (id && (startDate || endDate)) {
      loadAttendance()
    } else if (id && !startDate && !endDate) {
      setAttendance([])
      setTotalHours(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, startDate, endDate])

  const loadClientData = async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const data = await clientsApi.getById(parseInt(id)) as ClientWithParents
      setClientData(data)
    } catch (error) {
      console.error('Error loading client data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadLastVisit = async () => {
    if (!id) return
    try {
      const records = await attendanceApi.getClientAttendance(parseInt(id)) as AttendanceRecord[]
      const presentRecords = records.filter(r => r.status === 'present')
      if (presentRecords.length > 0) {
        setLastVisitDate(presentRecords[0].lesson_date)
      } else {
        setLastVisitDate(null)
      }
    } catch (error) {
      console.error('Error loading last visit:', error)
      setLastVisitDate(null)
    }
  }

  const loadAttendance = async () => {
    if (!id) return
    try {
      const records = await attendanceApi.getClientAttendance(
        parseInt(id),
        startDate || undefined,
        endDate || undefined
      ) as AttendanceRecord[]
      
      setAttendance(records)
      
      const hours = records
        .filter(r => r.status === 'present')
        .reduce((total, record) => {
          const startTime = record.start_time.length === 5 ? `${record.start_time}:00` : record.start_time
          const endTime = record.end_time.length === 5 ? `${record.end_time}:00` : record.end_time
          const start = new Date(`${record.lesson_date}T${startTime}`)
          const end = new Date(`${record.lesson_date}T${endTime}`)
          const diffMs = end.getTime() - start.getTime()
          const diffHours = diffMs / (1000 * 60 * 60)
          return total + diffHours
        }, 0)
      
      setTotalHours(Math.round(hours * 10) / 10)
    } catch (error) {
      console.error('Error loading attendance:', error)
    }
  }

  const getPaymentStatus = () => {
    if (!currentSubscription) {
      return { text: 'Не оплачен', variant: 'destructive' as const }
    }

    const end = new Date(currentSubscription.end_date)
    const outOfVisits = currentSubscription.visits_total > 0 
      && currentSubscription.visits_used >= currentSubscription.visits_total

    if (!currentSubscription.is_paid || end < new Date() || outOfVisits) {
      return { text: 'Не оплачен', variant: 'destructive' as const }
    }

    return { text: 'Оплачен', variant: 'default' as const }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Загрузка...</p>
      </div>
    )
  }

  if (!clientData) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Клиент не найден</p>
      </div>
    )
  }

  const paymentStatus = getPaymentStatus()

  return (
    <div className="flex flex-col h-full">
      <Header title={clientData.full_name} subtitle="Информация о клиенте" />
      
      <div className="flex-1 p-6 overflow-auto">
        <Button variant="ghost" onClick={() => navigate('/clients')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к клиентам
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Основная информация</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-500 text-xs">ФИО</Label>
                <p className="font-medium text-base">{clientData.full_name}</p>
              </div>
              <div>
                <Label className="text-slate-500 text-xs">Возраст</Label>
                <p className="font-medium">{calculateAge(clientData.birth_date ?? clientData.birth_year)}</p>
              </div>
              <div>
                <Label className="text-slate-500 text-xs">Дата рождения</Label>
                <p className="font-medium">{clientData.birth_date ? formatDate(clientData.birth_date) : 'Не указана'}</p>
              </div>
              <div>
                <Label className="text-slate-500 text-xs">Телефон</Label>
                <p className="font-medium">{formatPhone(clientData.phone) || 'Не указан'}</p>
              </div>
              <div>
                <Label className="text-slate-500 text-xs">Дата регистрации</Label>
                <p className="font-medium">{formatDate(clientData.created_at)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Статус оплаты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-slate-500 text-xs">Статус</Label>
                <div className="mt-1">
                  <Badge variant={paymentStatus.variant}>{paymentStatus.text}</Badge>
                </div>
              </div>
              <div>
                <Label className="text-slate-500 text-xs">Абонемент</Label>
                <p className="font-medium">
                  {currentSubscription ? currentSubscription.subscription_name : 'Не назначен'}
                </p>
              </div>
              {currentSubscription && (
                <div className="space-y-1 text-sm">
                  <p className="flex justify-between">
                    <span className="text-slate-500">Период:</span>
                    <span className="font-medium">
                      {formatDate(currentSubscription.start_date)} — {formatDate(currentSubscription.end_date)}
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-slate-500">Посещений:</span>
                    <span className="font-medium">
                      {currentSubscription.visits_total === 0
                        ? 'Безлимит'
                        : `${currentSubscription.visits_used} / ${currentSubscription.visits_total}`}
                    </span>
                  </p>
                </div>
              )}
              <div>
                <Label className="text-slate-500 text-xs">Дата последнего посещения</Label>
                <p className="font-medium">{lastVisitDate ? formatDate(lastVisitDate) : 'Нет посещений'}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Документы и адрес</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-slate-500 text-xs">Тип документа</Label>
                <p className="font-medium">
                  {clientData.doc_type === 'passport' && 'Паспорт'}
                  {clientData.doc_type === 'certificate' && 'Свидетельство'}
                  {!clientData.doc_type && 'Не указан'}
                </p>
              </div>
              <div>
                <Label className="text-slate-500 text-xs">Серия и номер</Label>
                <p className="font-medium">
                  {clientData.doc_series || clientData.doc_number
                    ? `${clientData.doc_series ?? ''} ${clientData.doc_number ?? ''}`.trim()
                    : 'Не указаны'}
                </p>
              </div>
              <div>
                <Label className="text-slate-500 text-xs">Кем выдан</Label>
                <p className="font-medium">{clientData.doc_issued_by || 'Не указано'}</p>
              </div>
              <div>
                <Label className="text-slate-500 text-xs">Дата выдачи</Label>
                <p className="font-medium">{clientData.doc_issued_date ? formatDate(clientData.doc_issued_date) : 'Не указана'}</p>
              </div>
              <div className="md:col-span-2">
                <Label className="text-slate-500 text-xs">Домашний адрес</Label>
                <p className="font-medium">{clientData.home_address || 'Не указан'}</p>
              </div>
              <div className="md:col-span-2">
                <Label className="text-slate-500 text-xs">Место работы/учёбы</Label>
                <p className="font-medium">{clientData.workplace || 'Не указано'}</p>
              </div>
            </CardContent>
          </Card>

          {clientData.parents && clientData.parents.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Родители</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {clientData.parents.map((parent) => (
                    <div key={parent.id} className="p-4 bg-slate-50 rounded-lg">
                      <p className="font-medium">{parent.full_name}</p>
                      {parent.phone && (
                        <p className="text-sm text-slate-600 mt-1">{formatPhone(parent.phone)}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Статистика посещений</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startDate">Начало периода</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="endDate">Конец периода</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              {(startDate || endDate) && (
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Количество часов посещений:</span>
                    <span className="text-lg font-bold">{totalHours}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-2 mt-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Абонементы</h2>
              <Button 
                size="sm" 
                onClick={() => setIsAssignDialogOpen(true)}
                style={{ backgroundColor: '#0c194b', color: '#fff' }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Назначить
              </Button>
            </div>
            
            {clientSubscriptions.length === 0 ? (
              <p className="text-slate-500">Нет абонементов</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {clientSubscriptions.map((sub) => (
                  <ClientSubscriptionCard 
                    key={sub.id} 
                    subscription={sub} 
                    onMarkPaid={handleMarkPaid}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <AssignSubscriptionDialog
          open={isAssignDialogOpen}
          onOpenChange={setIsAssignDialogOpen}
          clientId={clientData.id}
          clientName={clientData.full_name}
          onSuccess={handleSubscriptionAssigned}
        />
      </div>
    </div>
  )
}

