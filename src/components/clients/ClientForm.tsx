import { useEffect, useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import { clientsApi, subscriptionsApi } from '@/lib/api'
import type { Client, Subscription, ClientSubscription } from '@/types'

interface ClientFormData {
  full_name: string
  birth_date: string
  phone: string
  parents: { full_name: string; phone: string }[]
  subscription_id?: number | null
  doc_type: 'passport' | 'certificate' | ''
  doc_series: string
  doc_number: string
  doc_issued_by: string
  doc_issued_date: string
  home_address: string
  workplace: string
}

interface ClientFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: Client | null
  onSubmit: (data: any) => Promise<void>
}

export function ClientForm({ open, onOpenChange, client, onSubmit }: ClientFormProps) {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [selectedSubscription, setSelectedSubscription] = useState<number | null>(null)
  const [currentSubscription, setCurrentSubscription] = useState<ClientSubscription | null>(null)

  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClientFormData>({
    defaultValues: {
      full_name: '',
      birth_date: '',
      phone: '',
      parents: [],
      subscription_id: null,
      doc_type: '',
      doc_series: '',
      doc_number: '',
      doc_issued_by: '',
      doc_issued_date: '',
      home_address: '',
      workplace: ''
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parents'
  })

  useEffect(() => {
    if (open) {
      subscriptionsApi.getActive().then((data) => setSubscriptions(data as Subscription[]))
    }
  }, [open])

  const normalizeDateForInput = (value?: string | null) => {
    if (!value) return ''
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (trimmed.includes('T')) {
      return trimmed.split('T')[0]
    }
    if (trimmed.includes('.')) {
      const [day, month, year] = trimmed.split('.')
      if (day && month && year) {
        return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
    }
    return trimmed
  }

  const normalizeDateForSave = (value?: string | null) => {
    if (!value) return ''
    const trimmed = value.trim()
    if (!trimmed) return ''
    if (trimmed.includes('.')) {
      const [day, month, year] = trimmed.split('.')
      if (day && month && year) {
        const normalized = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
        return Number.isNaN(new Date(normalized).getTime()) ? '' : normalized
      }
    }
    return Number.isNaN(new Date(trimmed).getTime()) ? '' : trimmed
  }

  useEffect(() => {
    if (open && client) {
      const loadClientData = async () => {
        try {
          const clientWithParents = await clientsApi.getById(client.id) as any
          const clientSubs = await subscriptionsApi.getClientSubscriptions(client.id) as ClientSubscription[]
          const latestSub = clientSubs.length > 0 ? clientSubs[0] : null
          setCurrentSubscription(latestSub)
          setSelectedSubscription(latestSub?.subscription_id ?? null)
          reset({
            full_name: client.full_name || '',
            birth_date: normalizeDateForInput(clientWithParents?.birth_date) || '',
            phone: client.phone || '',
            doc_type: clientWithParents?.doc_type || '',
            doc_series: clientWithParents?.doc_series || '',
            doc_number: clientWithParents?.doc_number || '',
            doc_issued_by: clientWithParents?.doc_issued_by || '',
            doc_issued_date: normalizeDateForInput(clientWithParents?.doc_issued_date) || '',
            home_address: clientWithParents?.home_address || '',
            workplace: clientWithParents?.workplace || '',
            parents: clientWithParents?.parents?.map((p: any) => ({
              full_name: p.full_name || '',
              phone: p.phone || ''
            })) || []
          })
        } catch (error) {
          reset({
            full_name: client.full_name || '',
            birth_date: '',
            phone: client.phone || '',
            parents: [],
            doc_type: '',
            doc_series: '',
            doc_number: '',
            doc_issued_by: '',
            doc_issued_date: '',
            home_address: '',
            workplace: ''
          })
          setCurrentSubscription(null)
          setSelectedSubscription(null)
        }
      }
      loadClientData()
    } else if (open && !client) {
      reset({
        full_name: '',
        birth_date: '',
        phone: '',
        parents: [],
        doc_type: '',
        doc_series: '',
        doc_number: '',
        doc_issued_by: '',
        doc_issued_date: '',
        home_address: '',
        workplace: ''
      })
      setCurrentSubscription(null)
      setSelectedSubscription(null)
    }
  }, [open, client, reset])

  const handleFormSubmit = async (data: ClientFormData) => {
    await onSubmit({
      full_name: data.full_name,
      birth_date: normalizeDateForSave(data.birth_date) || undefined,
      phone: data.phone || undefined,
      parents: data.parents.filter(p => p.full_name.trim()),
      subscription_id: selectedSubscription || undefined,
      doc_type: data.doc_type || undefined,
      doc_series: data.doc_series || undefined,
      doc_number: data.doc_number || undefined,
      doc_issued_by: data.doc_issued_by || undefined,
      doc_issued_date: normalizeDateForSave(data.doc_issued_date) || undefined,
      home_address: data.home_address || undefined,
      workplace: data.workplace || undefined
    })
    reset()
    setSelectedSubscription(null)
    onOpenChange(false)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset()
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {client ? 'Редактировать клиента' : 'Добавить клиента'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">ФИО клиента *</Label>
            <Input
              id="full_name"
              {...register('full_name', { required: 'ФИО обязательно' })}
              placeholder="Петров Пётр Петрович"
            />
            {errors.full_name && (
              <p className="text-sm text-red-500">{errors.full_name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birth_date">Дата рождения</Label>
              <Input
                id="birth_date"
                type="text"
                {...register('birth_date')}
                placeholder="дд.мм.гггг"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                {...register('phone')}
                placeholder="+7 (999) 123-45-67"
              />
            </div>
          </div>

          <div className="space-y-3 p-3 border rounded-lg">
            <div className="font-medium">Документы</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="doc_type">Тип документа</Label>
                <Controller
                  control={control}
                  name="doc_type"
                  render={({ field }) => (
                    <Select
                      value={field.value || ''}
                      onValueChange={(v) => field.onChange(v as ClientFormData['doc_type'])}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="passport">Паспорт</SelectItem>
                        <SelectItem value="certificate">Свидетельство</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc_series">Серия</Label>
                <Input
                  id="doc_series"
                  {...register('doc_series')}
                  placeholder="Серия"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc_number">Номер</Label>
                <Input
                  id="doc_number"
                  {...register('doc_number')}
                  placeholder="Номер"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc_issued_by">Выдан</Label>
                <Input
                  id="doc_issued_by"
                  {...register('doc_issued_by')}
                  placeholder="Кем выдан"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doc_issued_date">Дата выдачи</Label>
                <Input
                  id="doc_issued_date"
                  type="text"
                  {...register('doc_issued_date')}
                  placeholder="дд.мм.гггг"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="home_address">Домашний адрес</Label>
                <Input
                  id="home_address"
                  {...register('home_address')}
                  placeholder="Адрес проживания"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="workplace">Место работы/учёбы</Label>
                <Input
                  id="workplace"
                  {...register('workplace')}
                  placeholder="Название организации/учебного заведения"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Абонемент</Label>
            <Select 
              value={selectedSubscription?.toString() || ''} 
              onValueChange={(v) => setSelectedSubscription(v ? parseInt(v) : null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите абонемент" />
              </SelectTrigger>
              <SelectContent>
                {subscriptions.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id.toString()}>
                    {sub.name} — {sub.price.toLocaleString()} ₽
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {currentSubscription && (
              <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Текущий:</span>
                  <span className="font-medium">{currentSubscription.subscription_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Период:</span>
                  <span className="font-medium">
                    {currentSubscription.start_date} — {currentSubscription.end_date}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Посещений:</span>
                  <span className="font-medium">
                    {currentSubscription.visits_total === 0 
                      ? 'Безлимит' 
                      : `${currentSubscription.visits_used} / ${currentSubscription.visits_total}`}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Родители</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ full_name: '', phone: '' })}
              >
                <Plus className="w-4 h-4 mr-1" />
                Добавить
              </Button>
            </div>

            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2 items-start p-3 bg-slate-50 rounded-lg">
                <div className="flex-1 space-y-2">
                  <Input
                    {...register(`parents.${index}.full_name`)}
                    placeholder="ФИО родителя"
                  />
                  <Input
                    {...register(`parents.${index}.phone`)}
                    placeholder="Телефон родителя"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-red-500"
                  onClick={() => remove(index)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              style={{ backgroundColor: '#0c194b', color: '#fff' }}
              onMouseEnter={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = '#0f1f5a')}
              onMouseLeave={(e) => !isSubmitting && (e.currentTarget.style.backgroundColor = '#0c194b')}
            >
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

