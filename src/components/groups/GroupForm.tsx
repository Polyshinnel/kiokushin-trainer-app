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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Group, Employee } from '@/types'
import { useEmployeesStore } from '@/stores/employeesStore'

interface GroupFormData {
  name: string
  start_date: string
  trainer_id: string
}

interface GroupFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  group?: Group | null
  onSubmit: (data: any) => Promise<void>
}

export function GroupForm({ open, onOpenChange, group, onSubmit }: GroupFormProps) {
  const { employees, fetchEmployees } = useEmployeesStore()
  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<GroupFormData>({
    defaultValues: {
      name: group?.name || '',
      start_date: group?.start_date || '',
      trainer_id: group?.trainer_id?.toString() || 'none'
    }
  })

  const trainerId = watch('trainer_id')

  useEffect(() => {
    if (open) {
      fetchEmployees()
    }
  }, [open, fetchEmployees])

  useEffect(() => {
    if (open && group) {
      reset({
        name: group.name || '',
        start_date: group.start_date || '',
        trainer_id: group.trainer_id?.toString() || 'none'
      })
    } else if (open && !group) {
      reset({
        name: '',
        start_date: '',
        trainer_id: 'none'
      })
    }
  }, [open, group, reset])

  const handleFormSubmit = async (data: GroupFormData) => {
    await onSubmit({
      name: data.name,
      start_date: data.start_date || undefined,
      trainer_id: data.trainer_id && data.trainer_id !== 'none' ? parseInt(data.trainer_id) : undefined
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
            {group ? 'Редактировать группу' : 'Создать группу'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Название группы *</Label>
            <Input
              id="name"
              {...register('name', { required: 'Название обязательно' })}
              placeholder="Группа начинающих"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="start_date">Дата начала</Label>
            <Input
              id="start_date"
              type="date"
              {...register('start_date')}
            />
          </div>

          <div className="space-y-2">
            <Label>Тренер</Label>
            <Select
              value={trainerId}
              onValueChange={(value) => setValue('trainer_id', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Выберите тренера" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не назначен</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id.toString()}>
                    {employee.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
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

