import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useGroupsStore } from '@/stores/groupsStore'
import { GroupsList } from '@/components/groups/GroupsList'
import { GroupForm } from '@/components/groups/GroupForm'
import { DeleteConfirmDialog } from '@/components/shared/DeleteConfirmDialog'
import { toast } from 'sonner'
import type { Group } from '@/types'

export function Groups() {
  const { 
    groups, isLoading,
    fetchGroups,
    createGroup, updateGroup, deleteGroup 
  } = useGroupsStore()
  
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<Group | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  const handleCreate = () => {
    setEditingGroup(null)
    setIsFormOpen(true)
  }

  const handleEdit = (group: Group) => {
    setEditingGroup(group)
    setIsFormOpen(true)
  }

  const handleSubmit = async (data: any) => {
    try {
      if (editingGroup) {
        await updateGroup(editingGroup.id, data)
        toast.success('Группа обновлена')
      } else {
        await createGroup(data)
        toast.success('Группа создана')
      }
      await fetchGroups()
    } catch (error) {
      toast.error('Ошибка')
    }
  }

  const handleDelete = async () => {
    if (!deletingGroup) return
    setIsDeleting(true)
    try {
      await deleteGroup(deletingGroup.id)
      toast.success('Группа удалена')
      setDeletingGroup(null)
    } catch (error) {
      toast.error('Ошибка')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Группы" subtitle={`Всего: ${groups.length}`} />
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between">
            <div className="flex-1"></div>
            <Button 
              onClick={handleCreate}
              style={{ backgroundColor: '#0c194b', color: '#fff' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0f1f5a'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#0c194b'}
            >
              <Plus className="w-4 h-4 mr-2" />
              Добавить группу
            </Button>
          </div>
          
          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">Загрузка...</div>
            ) : (
              <GroupsList
                groups={groups}
                onEdit={handleEdit}
                onDelete={setDeletingGroup}
              />
            )}
          </div>
        </div>
      </div>

      <GroupForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        group={editingGroup}
        onSubmit={handleSubmit}
      />

      <DeleteConfirmDialog
        open={!!deletingGroup}
        onOpenChange={(open) => !open && setDeletingGroup(null)}
        title="Удалить группу?"
        description={`Вы уверены, что хотите удалить группу "${deletingGroup?.name}"? Все связанные данные будут удалены.`}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </div>
  )
}
