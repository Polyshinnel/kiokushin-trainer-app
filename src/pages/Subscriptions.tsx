import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useSubscriptionsStore } from '@/stores/subscriptionsStore'
import { SubscriptionsTable } from '@/components/subscriptions/SubscriptionsTable'
import { SubscriptionForm } from '@/components/subscriptions/SubscriptionForm'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { toast } from 'sonner'
import type { Subscription } from '@/types'

export function Subscriptions() {
  const { subscriptions, isLoading, fetchSubscriptions, createSubscription, updateSubscription, deleteSubscription } = useSubscriptionsStore()
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null)
  const [deletingSubscription, setDeletingSubscription] = useState<Subscription | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  const handleCreate = () => {
    setEditingSubscription(null)
    setIsFormOpen(true)
  }

  const handleEdit = (subscription: Subscription) => {
    setEditingSubscription(subscription)
    setIsFormOpen(true)
  }

  const handleSubmit = async (data: any) => {
    try {
      if (editingSubscription) {
        await updateSubscription(editingSubscription.id, data)
        toast.success('Абонемент обновлён')
      } else {
        await createSubscription(data)
        toast.success('Абонемент создан')
      }
      setIsFormOpen(false)
    } catch (error) {
      toast.error('Ошибка сохранения')
    }
  }

  const handleDelete = async () => {
    if (!deletingSubscription) return
    setIsDeleting(true)
    try {
      await deleteSubscription(deletingSubscription.id)
      toast.success('Абонемент удалён')
      setDeletingSubscription(null)
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Абонементы" subtitle={`Всего: ${subscriptions.length}`} />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex justify-end">
            <Button 
              onClick={handleCreate}
              style={{ backgroundColor: '#0c194b', color: '#fff' }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить
            </Button>
          </div>
          
          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">Загрузка...</div>
            ) : (
              <SubscriptionsTable
                subscriptions={subscriptions}
                onEdit={handleEdit}
                onDelete={setDeletingSubscription}
              />
            )}
          </div>
        </div>
      </div>

      <SubscriptionForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        subscription={editingSubscription}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmDialog
        open={!!deletingSubscription}
        onOpenChange={(open) => !open && setDeletingSubscription(null)}
        title="Удалить абонемент?"
        description={`Вы уверены, что хотите удалить "${deletingSubscription?.name}"?`}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
}

