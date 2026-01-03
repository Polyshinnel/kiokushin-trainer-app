import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
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
import type { Employee } from '@/types'

interface EmployeeFormData {
  full_name: string
  birth_year: string
  phone: string
  login: string
  password: string
  changePassword: boolean
}

interface EmployeeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: Employee | null
  onSubmit: (data: { full_name: string; birth_year?: number; phone?: string; login?: string; password?: string }) => Promise<void>
}

export function EmployeeForm({ open, onOpenChange, employee, onSubmit }: EmployeeFormProps) {
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<EmployeeFormData>({
    defaultValues: {
      full_name: '',
      birth_year: '',
      phone: '',
      login: '',
      password: '',
      changePassword: false
    }
  })

  useEffect(() => {
    if (open) {
      reset({
        full_name: employee?.full_name || '',
        birth_year: employee?.birth_year?.toString() || '',
        phone: employee?.phone || '',
        login: employee?.login || '',
        password: '',
        changePassword: false
      })
    }
  }, [open, employee, reset])

  const changePassword = watch('changePassword')

  const handleFormSubmit = async (data: EmployeeFormData) => {
    await onSubmit({
      full_name: data.full_name,
      birth_year: data.birth_year ? parseInt(data.birth_year) : undefined,
      phone: data.phone || undefined,
      login: data.login || undefined,
      password: data.changePassword && data.password ? data.password : undefined
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {employee ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">ФИО *</Label>
            <Input
              id="full_name"
              {...register('full_name', { required: 'ФИО обязательно' })}
              placeholder="Иванов Иван Иванович"
            />
            {errors.full_name && (
              <p className="text-sm text-red-500">{errors.full_name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="birth_year">Год рождения</Label>
            <Input
              id="birth_year"
              type="number"
              {...register('birth_year', {
                min: { value: 1940, message: 'Некорректный год' },
                max: { value: new Date().getFullYear(), message: 'Некорректный год' }
              })}
              placeholder="1990"
            />
            {errors.birth_year && (
              <p className="text-sm text-red-500">{errors.birth_year.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              {...register('phone')}
              placeholder="+7 (999) 123-45-67"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="login">Логин</Label>
            <Input
              id="login"
              {...register('login')}
              placeholder="username"
            />
          </div>

          {employee && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="changePassword"
                  {...register('changePassword')}
                  className="rounded border-slate-300"
                />
                <Label htmlFor="changePassword" className="font-normal cursor-pointer">
                  Изменить пароль
                </Label>
              </div>
            </div>
          )}

          {(!employee || changePassword) && (
            <div className="space-y-2">
              <Label htmlFor="password">
                {employee ? 'Новый пароль' : 'Пароль'}
              </Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>
          )}

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

