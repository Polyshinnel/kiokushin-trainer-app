import { useNavigate } from 'react-router-dom'
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
import { Pencil, Trash2, CreditCard, Eye } from 'lucide-react'
import { calculateAge, formatPhone, formatDate } from '@/lib/utils'

interface ClientsTableProps {
  clients: Client[]
  onEdit: (client: Client) => void
  onDelete: (client: Client) => void
  onPayment: (client: Client) => void
}

export function ClientsTable({ clients, onEdit, onDelete, onPayment }: ClientsTableProps) {
  const navigate = useNavigate()
  const isDebtor = (client: Client) => {
    if (client.current_subscription_status) {
      return client.current_subscription_status === 'unpaid' 
        || client.current_subscription_status === 'expired' 
        || client.current_subscription_status === 'none'
    }
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
          <TableHead>Абонемент</TableHead>
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
            <TableCell>{calculateAge(client.birth_date ?? client.birth_year)}</TableCell>
            <TableCell>{formatPhone(client.phone)}</TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">
                  {client.current_subscription_name || 'Не назначен'}
                </span>
                <span className="text-xs text-slate-500">
                  {client.current_subscription_end_date 
                    ? `до ${formatDate(client.current_subscription_end_date)}`
                    : 'без даты'}
                </span>
                {client.current_subscription_status && client.current_subscription_status !== 'paid' && (
                  <Badge variant="destructive" className="mt-1 w-fit text-xs">
                    Не оплачен
                  </Badge>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Просмотр информации"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <Eye className="w-4 h-4" />
                </Button>
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

