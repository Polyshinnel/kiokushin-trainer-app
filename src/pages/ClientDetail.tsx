import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'
import { clientsApi, attendanceApi } from '@/lib/api'
import { calculateAge, formatPhone, formatDate } from '@/lib/utils'

interface ClientWithParents {
  id: number
  full_name: string
  birth_year: number | null
  phone: string | null
  last_payment_date: string | null
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

  useEffect(() => {
    if (id) {
      loadClientData()
      loadLastVisit()
    }
  }, [id])

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
    if (!clientData?.last_payment_date) {
      return { text: 'Не оплачено', variant: 'destructive' as const }
    }
    const paymentDate = new Date(clientData.last_payment_date)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    if (paymentDate < thirtyDaysAgo) {
      return { text: 'Просрочено', variant: 'destructive' as const }
    }
    return { text: 'Оплачено', variant: 'default' as const }
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
                <p className="font-medium">{calculateAge(clientData.birth_year)}</p>
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
              {clientData.last_payment_date && (
                <div>
                  <Label className="text-slate-500 text-xs">Последняя оплата</Label>
                  <p className="font-medium">{formatDate(clientData.last_payment_date)}</p>
                </div>
              )}
              <div>
                <Label className="text-slate-500 text-xs">Дата последнего посещения</Label>
                <p className="font-medium">{lastVisitDate ? formatDate(lastVisitDate) : 'Нет посещений'}</p>
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
        </div>
      </div>
    </div>
  )
}

