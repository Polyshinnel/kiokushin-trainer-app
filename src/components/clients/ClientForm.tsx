import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
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
import { Plus, Trash2 } from 'lucide-react'
import { clientsApi } from '@/lib/api'
import type { Client } from '@/types'

interface ClientFormData {
  full_name: string
  birth_year: string
  phone: string
  parents: { full_name: string; phone: string }[]
}

interface ClientFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  client?: Client | null
  onSubmit: (data: any) => Promise<void>
}

export function ClientForm({ open, onOpenChange, client, onSubmit }: ClientFormProps) {
  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClientFormData>({
    defaultValues: {
      full_name: '',
      birth_year: '',
      phone: '',
      parents: []
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parents'
  })

  useEffect(() => {
    if (open && client) {
      const loadClientData = async () => {
        try {
          const clientWithParents = await clientsApi.getById(client.id) as any
          reset({
            full_name: client.full_name || '',
            birth_year: client.birth_year?.toString() || '',
            phone: client.phone || '',
            parents: clientWithParents?.parents?.map((p: any) => ({
              full_name: p.full_name || '',
              phone: p.phone || ''
            })) || []
          })
        } catch (error) {
          reset({
            full_name: client.full_name || '',
            birth_year: client.birth_year?.toString() || '',
            phone: client.phone || '',
            parents: []
          })
        }
      }
      loadClientData()
    } else if (open && !client) {
      reset({
        full_name: '',
        birth_year: '',
        phone: '',
        parents: []
      })
    }
  }, [open, client, reset])

  const handleFormSubmit = async (data: ClientFormData) => {
    await onSubmit({
      full_name: data.full_name,
      birth_year: data.birth_year ? parseInt(data.birth_year) : undefined,
      phone: data.phone || undefined,
      parents: data.parents.filter(p => p.full_name.trim())
    })
    reset()
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birth_year">Год рождения</Label>
              <Input
                id="birth_year"
                type="number"
                {...register('birth_year')}
                placeholder="2010"
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

