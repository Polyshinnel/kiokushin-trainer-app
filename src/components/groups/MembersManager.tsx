import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Plus, UserMinus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { clientsApi } from '@/lib/api'
import type { GroupMember, Client } from '@/types'

interface MembersManagerProps {
  members: GroupMember[]
  onAdd: (clientId: number) => Promise<void>
  onRemove: (clientId: number) => Promise<void>
}

export function MembersManager({ members, onAdd, onRemove }: MembersManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [availableClients, setAvailableClients] = useState<Client[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (isDialogOpen) {
      loadClients()
    }
  }, [isDialogOpen])

  const loadClients = async () => {
    const clients = await clientsApi.getAll() as Client[]
    const memberIds = new Set(members.map(m => m.client_id))
    setAvailableClients(clients.filter(c => !memberIds.has(c.id)))
  }

  const filteredClients = availableClients.filter(c =>
    c.full_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAddClient = async (clientId: number) => {
    await onAdd(clientId)
    setAvailableClients(prev => prev.filter(c => c.id !== clientId))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Участники ({members.length})</h4>
        <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Добавить
        </Button>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-slate-500">Нет участников</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ФИО</TableHead>
              <TableHead>Телефон</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>{member.client?.full_name}</TableCell>
                <TableCell>{member.client?.phone || '—'}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500"
                    onClick={() => onRemove(member.client_id)}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Добавить участника</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск клиента..."
                className="pl-10"
              />
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {filteredClients.length === 0 ? (
                <p className="text-center py-4 text-slate-500">
                  Нет доступных клиентов
                </p>
              ) : (
                filteredClients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{client.full_name}</p>
                      <p className="text-sm text-slate-500">{client.phone}</p>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => handleAddClient(client.id)}
                      style={{ backgroundColor: '#0c194b', color: '#fff' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0f1f5a'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0c194b'}
                    >
                      Добавить
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

