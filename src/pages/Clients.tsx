import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useClientsStore } from '@/stores/clientsStore'
import { ClientsTable } from '@/components/clients/ClientsTable'
import { ClientForm } from '@/components/clients/ClientForm'
import { PaymentDialog } from '@/components/clients/PaymentDialog'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { SearchInput } from '@/components/shared/SearchInput'
import { Pagination } from '@/components/shared/Pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { clientsApi, subscriptionsApi } from '@/lib/api'
import type { Client } from '@/types'

export function Clients() {
  const { 
    clients, isLoading, searchQuery, subscriptionFilter,
    totalCount, currentPage, pageSize,
    fetchClients, searchClients, setSearchQuery, setSubscriptionFilter, setPage,
    createClient, updateClient, deleteClient 
  } = useClientsStore()
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [payingClient, setPayingClient] = useState<Client | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  const handleSearch = (query?: string) => {
    const searchValue = query !== undefined ? query : searchQuery
    if (!searchValue.trim()) {
      searchClients('')
    } else {
      searchClients(searchValue)
    }
  }

  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0

  const handleCreate = () => {
    setEditingClient(null)
    setIsFormOpen(true)
  }

  const handleEdit = (client: Client) => {
    setEditingClient(client)
    setIsFormOpen(true)
  }

  const handleSubmit = async (data: any) => {
    try {
      if (editingClient) {
        await updateClient(editingClient.id, data)
        
        const clientWithParents = await clientsApi.getById(editingClient.id) as any
        const existingParents = clientWithParents?.parents || []
        
        for (const existingParent of existingParents) {
          await clientsApi.removeParent(existingParent.id)
        }
        
        if (data.parents && data.parents.length > 0) {
          for (const parent of data.parents) {
            await clientsApi.addParent(editingClient.id, parent)
          }
        }
        
        await fetchClients()
        toast.success('Клиент обновлён')
      } else {
        await createClient(data)
        toast.success('Клиент добавлен')
      }
    } catch (error) {
      const message = (error as any)?.message || ''
      if (
        (typeof message === 'string' && message.includes('CLIENT_DUPLICATE')) ||
        (error as any)?.code === 'CLIENT_DUPLICATE'
      ) {
        toast.error('Такой клиент уже создан (ФИО и дата рождения)')
        return
      }
      console.error('Error saving client:', error)
      toast.error('Ошибка')
    }
  }

  const handlePayment = async (date: string) => {
    if (!payingClient) return
    try {
      const subscriptionTypeId = (payingClient as any).current_subscription_type_id
      if (!subscriptionTypeId) {
        toast.error('У клиента не выбран тип абонемента')
        return
      }

      await subscriptionsApi.assign({
        client_id: payingClient.id,
        subscription_id: subscriptionTypeId,
        start_date: date,
        is_paid: true
      })

      await fetchClients()
      toast.success('Оплата отмечена')
    } catch (error) {
      console.error('Error renewing subscription:', error)
      toast.error('Ошибка')
    }
  }

  const handleDelete = async () => {
    if (!deletingClient) return
    setIsDeleting(true)
    try {
      await deleteClient(deletingClient.id)
      toast.success('Клиент удалён')
      setDeletingClient(null)
    } catch (error) {
      toast.error('Ошибка')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Клиенты" subtitle={`Всего: ${totalCount} (Страница ${currentPage} из ${totalPages})`} />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex flex-1 gap-4">
              <div className="flex-1 max-w-md">
                <SearchInput
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onSearch={handleSearch}
                  placeholder="Поиск по ФИО или телефону..."
                />
              </div>
              <Select value={subscriptionFilter} onValueChange={(value: 'all' | 'active' | 'expired' | 'unpaid') => setSubscriptionFilter(value)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Статус абонемента" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="active">Активный абонемент</SelectItem>
                  <SelectItem value="expired">Истёк/нет абонемента</SelectItem>
                  <SelectItem value="unpaid">Не оплачен</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              <>
                <ClientsTable
                  clients={clients}
                  onEdit={handleEdit}
                  onDelete={setDeletingClient}
                  onPayment={setPayingClient}
                />
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <ClientForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        client={editingClient}
        onSubmit={handleSubmit}
      />

      <PaymentDialog
        open={!!payingClient}
        onOpenChange={(open) => !open && setPayingClient(null)}
        client={payingClient}
        onConfirm={handlePayment}
      />

      <DeleteConfirmDialog
        open={!!deletingClient}
        onOpenChange={(open) => !open && setDeletingClient(null)}
        title="Удалить клиента?"
        description={`Вы уверены, что хотите удалить ${deletingClient?.full_name}? Все связанные данные будут удалены.`}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
}
