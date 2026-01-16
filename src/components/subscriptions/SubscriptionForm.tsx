import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import type { Subscription } from '@/types'

interface SubscriptionFormData {
  name: string
  price: string
  duration_days: string
  visit_limit: string
}

interface SubscriptionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subscription?: Subscription | null
  onSubmit: (data: any) => Promise<void>
}

export function SubscriptionForm({ open, onOpenChange, subscription, onSubmit }: SubscriptionFormProps) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SubscriptionFormData>()

  useEffect(() => {
    if (open && subscription) {
      reset({
        name: subscription.name,
        price: subscription.price.toString(),
        duration_days: subscription.duration_days.toString(),
        visit_limit: subscription.visit_limit.toString()
      })
    } else if (open) {
      reset({ name: '', price: '', duration_days: '30', visit_limit: '0' })
    }
  }, [open, subscription, reset])

  const handleFormSubmit = async (data: SubscriptionFormData) => {
    await onSubmit({
      name: data.name,
      price: parseFloat(data.price),
      duration_days: parseInt(data.duration_days),
      visit_limit: parseInt(data.visit_limit) || 0
    })
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            {subscription ? 'Редактировать абонемент' : 'Создать абонемент'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название *</Label>
            <Input
              id="name"
              {...register('name', { required: 'Название обязательно' })}
              placeholder="Стандартный"
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Цена (₽) *</Label>
              <Input
                id="price"
                type="number"
                {...register('price', { required: 'Цена обязательна', min: 0 })}
                placeholder="3500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration_days">Срок (дней) *</Label>
              <Input
                id="duration_days"
                type="number"
                {...register('duration_days', { required: true, min: 1 })}
                placeholder="30"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit_limit">Количество посещений</Label>
            <Input
              id="visit_limit"
              type="number"
              {...register('visit_limit')}
              placeholder="0 = безлимит"
            />
            <p className="text-xs text-slate-500">0 — неограниченное количество посещений</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              style={{ backgroundColor: '#0c194b', color: '#fff' }}
            >
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

