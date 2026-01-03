# Этап 4: Модуль "Сотрудники"

**Срок: 1 день**

---

## Цель этапа

Создать полнофункциональный модуль управления сотрудниками: список, добавление, редактирование и удаление.

---

## Шаги выполнения

### 4.1 Создание Zustand store для сотрудников

**Файл `src/stores/employeesStore.ts`:**
```typescript
import { create } from 'zustand'
import { employeesApi } from '@/lib/api'
import type { Employee } from '@/types'

interface EmployeesState {
  employees: Employee[]
  isLoading: boolean
  error: string | null
  
  fetchEmployees: () => Promise<void>
  createEmployee: (data: { full_name: string; birth_year?: number; phone?: string }) => Promise<Employee>
  updateEmployee: (id: number, data: Partial<Employee>) => Promise<Employee>
  deleteEmployee: (id: number) => Promise<boolean>
}

export const useEmployeesStore = create<EmployeesState>((set, get) => ({
  employees: [],
  isLoading: false,
  error: null,

  fetchEmployees: async () => {
    set({ isLoading: true, error: null })
    try {
      const employees = await employeesApi.getAll() as Employee[]
      set({ employees, isLoading: false })
    } catch (error) {
      set({ error: 'Ошибка загрузки сотрудников', isLoading: false })
    }
  },

  createEmployee: async (data) => {
    const employee = await employeesApi.create(data) as Employee
    set((state) => ({ employees: [...state.employees, employee] }))
    return employee
  },

  updateEmployee: async (id, data) => {
    const employee = await employeesApi.update(id, data) as Employee
    set((state) => ({
      employees: state.employees.map((e) => (e.id === id ? employee : e))
    }))
    return employee
  },

  deleteEmployee: async (id) => {
    const success = await employeesApi.delete(id) as boolean
    if (success) {
      set((state) => ({
        employees: state.employees.filter((e) => e.id !== id)
      }))
    }
    return success
  }
}))
```

### 4.2 Создание компонента таблицы сотрудников

**Файл `src/components/employees/EmployeesTable.tsx`:**
```typescript
import { Employee } from '@/types'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pencil, Trash2 } from 'lucide-react'
import { calculateAge, formatPhone } from '@/lib/utils'

interface EmployeesTableProps {
  employees: Employee[]
  onEdit: (employee: Employee) => void
  onDelete: (employee: Employee) => void
}

export function EmployeesTable({ employees, onEdit, onDelete }: EmployeesTableProps) {
  if (employees.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Нет сотрудников</p>
        <p className="text-sm mt-1">Добавьте первого сотрудника</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[300px]">ФИО</TableHead>
          <TableHead>Возраст</TableHead>
          <TableHead>Телефон</TableHead>
          <TableHead className="text-right">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => (
          <TableRow key={employee.id}>
            <TableCell className="font-medium">{employee.full_name}</TableCell>
            <TableCell>{calculateAge(employee.birth_year)}</TableCell>
            <TableCell>{formatPhone(employee.phone)}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(employee)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => onDelete(employee)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

### 4.3 Создание формы сотрудника

**Файл `src/components/employees/EmployeeForm.tsx`:**
```typescript
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
}

interface EmployeeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: Employee | null
  onSubmit: (data: { full_name: string; birth_year?: number; phone?: string }) => Promise<void>
}

export function EmployeeForm({ open, onOpenChange, employee, onSubmit }: EmployeeFormProps) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EmployeeFormData>({
    defaultValues: {
      full_name: employee?.full_name || '',
      birth_year: employee?.birth_year?.toString() || '',
      phone: employee?.phone || ''
    }
  })

  const handleFormSubmit = async (data: EmployeeFormData) => {
    await onSubmit({
      full_name: data.full_name,
      birth_year: data.birth_year ? parseInt(data.birth_year) : undefined,
      phone: data.phone || undefined
    })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

### 4.4 Создание диалога подтверждения удаления

**Файл `src/components/shared/DeleteConfirmDialog.tsx`:**
```typescript
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => void
  isDeleting?: boolean
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isDeleting
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-red-500 hover:bg-red-600"
          >
            {isDeleting ? 'Удаление...' : 'Удалить'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

### 4.5 Обновление страницы сотрудников

**Файл `src/pages/Employees.tsx`:**
```typescript
import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useEmployeesStore } from '@/stores/employeesStore'
import { EmployeesTable } from '@/components/employees/EmployeesTable'
import { EmployeeForm } from '@/components/employees/EmployeeForm'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { useToast } from '@/components/ui/use-toast'
import type { Employee } from '@/types'

export function Employees() {
  const { employees, isLoading, fetchEmployees, createEmployee, updateEmployee, deleteEmployee } = useEmployeesStore()
  const { toast } = useToast()
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [deletingEmployee, setDeletingEmployee] = useState<Employee | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  const handleCreate = () => {
    setEditingEmployee(null)
    setIsFormOpen(true)
  }

  const handleEdit = (employee: Employee) => {
    setEditingEmployee(employee)
    setIsFormOpen(true)
  }

  const handleSubmit = async (data: { full_name: string; birth_year?: number; phone?: string }) => {
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, data)
        toast({ title: 'Сотрудник обновлён' })
      } else {
        await createEmployee(data)
        toast({ title: 'Сотрудник добавлен' })
      }
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить', variant: 'destructive' })
    }
  }

  const handleDelete = async () => {
    if (!deletingEmployee) return
    
    setIsDeleting(true)
    try {
      await deleteEmployee(deletingEmployee.id)
      toast({ title: 'Сотрудник удалён' })
      setDeletingEmployee(null)
    } catch (error) {
      toast({ title: 'Ошибка', description: 'Не удалось удалить', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Сотрудники" subtitle={`Всего: ${employees.length}`} />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h3 className="font-semibold">Список сотрудников</h3>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </div>
          
          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">Загрузка...</div>
            ) : (
              <EmployeesTable
                employees={employees}
                onEdit={handleEdit}
                onDelete={setDeletingEmployee}
              />
            )}
          </div>
        </div>
      </div>

      <EmployeeForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        employee={editingEmployee}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmDialog
        open={!!deletingEmployee}
        onOpenChange={(open) => !open && setDeletingEmployee(null)}
        title="Удалить сотрудника?"
        description={`Вы уверены, что хотите удалить ${deletingEmployee?.full_name}? Это действие нельзя отменить.`}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
}
```

### 4.6 Установка react-hook-form

```bash
npm install react-hook-form
```

---

## Проверка успешности этапа

- [ ] Список сотрудников отображается
- [ ] Кнопка "Добавить" открывает форму
- [ ] Форма валидирует обязательные поля
- [ ] Сотрудник создаётся и появляется в списке
- [ ] Редактирование сотрудника работает
- [ ] Диалог подтверждения удаления появляется
- [ ] Удаление работает
- [ ] Toast-уведомления показываются

---

## Результат этапа

Полнофункциональный модуль управления сотрудниками:
- CRUD операции
- Валидация форм
- Подтверждение удаления
- Уведомления о действиях

