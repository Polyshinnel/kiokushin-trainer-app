import type { Employee } from '@/types'
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
          <TableHead>Логин</TableHead>
          <TableHead className="text-right">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => (
          <TableRow key={employee.id}>
            <TableCell className="font-medium">{employee.full_name}</TableCell>
            <TableCell>{calculateAge(employee.birth_year)}</TableCell>
            <TableCell>{formatPhone(employee.phone)}</TableCell>
            <TableCell>{employee.login || '—'}</TableCell>
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

