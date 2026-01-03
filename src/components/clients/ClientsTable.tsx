import type { Client } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Pencil, Trash2, CreditCard } from 'lucide-react'
import { calculateAge, formatPhone, formatDate } from '@/lib/utils'

interface ClientsTableProps {
  clients: Client[]
  onEdit: (client: Client) => void
  onDelete: (client: Client) => void
  onPayment: (client: Client) => void
}

export function ClientsTable({ clients, onEdit, onDelete, onPayment }: ClientsTableProps) {
  const isDebtor = (client: Client) => {
    if (!client.last_payment_date) return true
    const paymentDate = new Date(client.last_payment_date)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return paymentDate < thirtyDaysAgo
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p>Клиенты не найдены</p>
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[250px]">ФИО</TableHead>
          <TableHead>Возраст</TableHead>
          <TableHead>Телефон</TableHead>
          <TableHead>Последняя оплата</TableHead>
          <TableHead className="text-right">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client) => (
          <TableRow key={client.id}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-2">
                {client.full_name}
                {isDebtor(client) && (
                  <Badge variant="destructive" className="text-xs">Долг</Badge>
                )}
              </div>
            </TableCell>
            <TableCell>{calculateAge(client.birth_year)}</TableCell>
            <TableCell>{formatPhone(client.phone)}</TableCell>
            <TableCell>
              {client.last_payment_date 
                ? formatDate(client.last_payment_date)
                : <span className="text-slate-400">Не оплачено</span>
              }
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Отметить оплату"
                  onClick={() => onPayment(client)}
                >
                  <CreditCard className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(client)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => onDelete(client)}
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

