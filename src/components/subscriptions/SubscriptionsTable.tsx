import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2 } from 'lucide-react'
import type { Subscription } from '@/types'

interface SubscriptionsTableProps {
  subscriptions: Subscription[]
  onEdit: (subscription: Subscription) => void
  onDelete: (subscription: Subscription) => void
}

export function SubscriptionsTable({ subscriptions, onEdit, onDelete }: SubscriptionsTableProps) {
  const formatPrice = (price: number) => `${price.toLocaleString()} ₽`
  const formatDuration = (days: number) => {
    if (days === 30) return '1 месяц'
    if (days === 90) return '3 месяца'
    if (days === 180) return '6 месяцев'
    if (days === 365) return '1 год'
    return `${days} дн.`
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Название</TableHead>
          <TableHead>Цена</TableHead>
          <TableHead>Срок действия</TableHead>
          <TableHead>Посещений</TableHead>
          <TableHead>Статус</TableHead>
          <TableHead className="w-[100px]">Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center py-8 text-slate-500">
              Нет абонементов
            </TableCell>
          </TableRow>
        ) : (
          subscriptions.map((subscription) => (
            <TableRow key={subscription.id}>
              <TableCell className="font-medium">{subscription.name}</TableCell>
              <TableCell>{formatPrice(subscription.price)}</TableCell>
              <TableCell>{formatDuration(subscription.duration_days)}</TableCell>
              <TableCell>
                {subscription.visit_limit === 0 ? 'Безлимит' : subscription.visit_limit}
              </TableCell>
              <TableCell>
                <Badge variant={subscription.is_active ? 'default' : 'secondary'}>
                  {subscription.is_active ? 'Активен' : 'Неактивен'}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(subscription)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-red-500" onClick={() => onDelete(subscription)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

