import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useEmployeesStore } from '@/stores/employeesStore'
import { EmployeesTable } from '@/components/employees/EmployeesTable'
import { EmployeeForm } from '@/components/employees/EmployeeForm'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { toast } from 'sonner'
import type { Employee } from '@/types'

export function Employees() {
  const { employees, isLoading, fetchEmployees, createEmployee, updateEmployee, deleteEmployee } = useEmployeesStore()
  
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

  const handleSubmit = async (data: { full_name: string; birth_year?: number; phone?: string; login?: string; password?: string }) => {
    try {
      if (editingEmployee) {
        await updateEmployee(editingEmployee.id, data)
        toast.success('Сотрудник обновлён')
      } else {
        await createEmployee(data)
        toast.success('Сотрудник добавлен')
      }
    } catch (error) {
      toast.error('Не удалось сохранить')
    }
  }

  const handleDelete = async () => {
    if (!deletingEmployee) return
    
    setIsDeleting(true)
    try {
      await deleteEmployee(deletingEmployee.id)
      toast.success('Сотрудник удалён')
      setDeletingEmployee(null)
    } catch (error) {
      toast.error('Не удалось удалить')
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
            <Button 
              onClick={handleCreate}
              style={{ backgroundColor: '#0c194b', color: '#fff' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0f1f5a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0c194b'}
            >
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

