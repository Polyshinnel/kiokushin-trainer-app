import { create } from 'zustand'
import { clientsApi } from '@/lib/api'
import type { Client } from '@/types'

interface ClientsState {
  clients: Client[]
  debtors: Client[]
  isLoading: boolean
  searchQuery: string
  
  fetchClients: () => Promise<void>
  fetchDebtors: (days?: number) => Promise<void>
  searchClients: (query: string) => Promise<void>
  setSearchQuery: (query: string) => void
  createClient: (data: any) => Promise<Client>
  updateClient: (id: number, data: any) => Promise<Client>
  updatePaymentDate: (id: number, date: string) => Promise<void>
  deleteClient: (id: number) => Promise<boolean>
}

export const useClientsStore = create<ClientsState>((set, get) => ({
  clients: [],
  debtors: [],
  isLoading: false,
  searchQuery: '',

  fetchClients: async () => {
    set({ isLoading: true })
    try {
      const clients = await clientsApi.getAll() as Client[]
      set({ clients, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
    }
  },

  fetchDebtors: async (days = 30) => {
    const debtors = await clientsApi.getDebtors(days) as Client[]
    set({ debtors })
  },

  searchClients: async (query: string) => {
    if (!query.trim()) {
      return get().fetchClients()
    }
    set({ isLoading: true })
    try {
      const clients = await clientsApi.search(query) as Client[]
      set({ clients, isLoading: false })
    } catch (error) {
      set({ isLoading: false })
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },

  createClient: async (data) => {
    const client = await clientsApi.create(data) as Client
    set((state) => ({ clients: [...state.clients, client] }))
    return client
  },

  updateClient: async (id, data) => {
    const client = await clientsApi.update(id, data) as Client
    set((state) => ({
      clients: state.clients.map((c) => (c.id === id ? client : c))
    }))
    return client
  },

  updatePaymentDate: async (id, date) => {
    await clientsApi.updatePaymentDate(id, date)
    set((state) => ({
      clients: state.clients.map((c) => 
        c.id === id ? { ...c, last_payment_date: date } : c
      ),
      debtors: state.debtors.filter((c) => c.id !== id)
    }))
  },

  deleteClient: async (id) => {
    const success = await clientsApi.delete(id) as boolean
    if (success) {
      set((state) => ({
        clients: state.clients.filter((c) => c.id !== id),
        debtors: state.debtors.filter((c) => c.id !== id)
      }))
    }
    return success
  }
}))

