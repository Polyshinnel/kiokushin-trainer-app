import { create } from 'zustand'
import { groupsApi } from '@/lib/api'
import type { Group, GroupSchedule, GroupMember } from '@/types'

interface GroupWithDetails extends Group {
  schedule: GroupSchedule[]
  members: GroupMember[]
  trainer?: {
    id: number
    full_name: string
    [key: string]: any
  }
}

interface GroupsState {
  groups: Group[]
  currentGroup: GroupWithDetails | null
  isLoading: boolean
  
  fetchGroups: () => Promise<void>
  fetchGroupById: (id: number) => Promise<GroupWithDetails>
  createGroup: (data: any) => Promise<Group>
  updateGroup: (id: number, data: any) => Promise<Group>
  deleteGroup: (id: number) => Promise<boolean>
  
  addSchedule: (groupId: number, data: any) => Promise<void>
  removeSchedule: (scheduleId: number) => Promise<void>
  
  addMember: (groupId: number, clientId: number) => Promise<void>
  removeMember: (groupId: number, clientId: number) => Promise<void>
}

export const useGroupsStore = create<GroupsState>((set, get) => ({
  groups: [],
  currentGroup: null,
  isLoading: false,

  fetchGroups: async () => {
    set({ isLoading: true })
    try {
      const groups = await groupsApi.getAll() as Group[]
      set({ groups, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
    }
  },

  fetchGroupById: async (id) => {
    const group = await groupsApi.getById(id) as GroupWithDetails
    set({ currentGroup: group })
    return group
  },

  createGroup: async (data) => {
    const group = await groupsApi.create(data) as Group
    set((state) => ({ groups: [...state.groups, group] }))
    return group
  },

  updateGroup: async (id, data) => {
    const group = await groupsApi.update(id, data) as Group
    set((state) => ({
      groups: state.groups.map((g) => (g.id === id ? { ...g, ...group } : g))
    }))
    return group
  },

  deleteGroup: async (id) => {
    const success = await groupsApi.delete(id) as boolean
    if (success) {
      set((state) => ({
        groups: state.groups.filter((g) => g.id !== id)
      }))
    }
    return success
  },

  addSchedule: async (groupId, data) => {
    await groupsApi.addSchedule(groupId, data)
    get().fetchGroupById(groupId)
  },

  removeSchedule: async (scheduleId) => {
    const currentGroup = get().currentGroup
    await groupsApi.removeSchedule(scheduleId)
    if (currentGroup) {
      get().fetchGroupById(currentGroup.id)
    }
  },

  addMember: async (groupId, clientId) => {
    await groupsApi.addMember(groupId, clientId)
    get().fetchGroupById(groupId)
    get().fetchGroups()
  },

  removeMember: async (groupId, clientId) => {
    await groupsApi.removeMember(groupId, clientId)
    get().fetchGroupById(groupId)
    get().fetchGroups()
  }
}))

