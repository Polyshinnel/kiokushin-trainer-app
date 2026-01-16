import { create } from 'zustand'
import { clientsApi } from '@/lib/api'
import type { Client } from '@/types'

interface ClientsState {
  clients: Client[]
  debtors: Client[]
  isLoading: boolean
  searchQuery: string
  subscriptionFilter: 'all' | 'active' | 'expired' | 'unpaid'
  totalCount: number
  currentPage: number
  pageSize: number
  
  fetchClients: () => Promise<void>
  fetchDebtors: (days?: number) => Promise<void>
  searchClients: (query: string) => Promise<void>
  setSearchQuery: (query: string) => void
  setSubscriptionFilter: (filter: 'all' | 'active' | 'expired' | 'unpaid') => void
  setPage: (page: number) => void
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
  subscriptionFilter: 'all',
  totalCount: 0,
  currentPage: 1,
  pageSize: 20,

  fetchClients: async () => {
    set({ isLoading: true })
    try {
      const state = get()
      const filters: any = {
        page: state.currentPage,
        limit: state.pageSize,
        searchQuery: state.searchQuery
      }
      if (state.subscriptionFilter !== 'all') {
        filters.subscriptionStatus = state.subscriptionFilter
      }
      const result = await clientsApi.getAll(filters) as { data: Client[]; total: number }
      
      if (result && typeof result === 'object' && 'data' in result && 'total' in result) {
        set({ 
          clients: result.data || [], 
          totalCount: result.total || 0,
          isLoading: false 
        })
      } else {
        set({ 
          clients: [], 
          totalCount: 0,
          isLoading: false 
        })
      }
    } catch (error) {
      console.error('Error fetching clients:', error)
      set({ isLoading: false })
    }
  },

  fetchDebtors: async (days = 30) => {
    const debtors = await clientsApi.getDebtors(days) as Client[]
    set({ debtors })
  },

  searchClients: async (query: string) => {
    if (!query.trim()) {
      set({ searchQuery: '', currentPage: 1 })
      return get().fetchClients()
    }
    set({ isLoading: true, searchQuery: query, currentPage: 1 })
    try {
      const state = get()
      const filters: any = {
        page: state.currentPage,
        limit: state.pageSize
      }
      if (state.subscriptionFilter !== 'all') {
        filters.subscriptionStatus = state.subscriptionFilter
      }
      const result = await clientsApi.search(query, filters) as { data: Client[]; total: number }
      
      if (result && typeof result === 'object' && 'data' in result && 'total' in result) {
        set({ 
          clients: result.data || [], 
          totalCount: result.total || 0,
          isLoading: false 
        })
      } else {
        set({ 
          clients: [], 
          totalCount: 0,
          isLoading: false 
        })
      }
    } catch (error) {
      console.error('Error searching clients:', error)
      set({ isLoading: false })
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
  },

  setSubscriptionFilter: (filter: 'all' | 'active' | 'expired' | 'unpaid') => {
    set({ subscriptionFilter: filter, currentPage: 1 })
    const state = get()
    if (state.searchQuery.trim()) {
      get().searchClients(state.searchQuery)
    } else {
      get().fetchClients()
    }
  },

  setPage: (page: number) => {
    set({ currentPage: page })
    const state = get()
    if (state.searchQuery.trim()) {
      get().searchClients(state.searchQuery)
    } else {
      get().fetchClients()
    }
  },

  createClient: async (data) => {
    const client = await clientsApi.create(data) as Client
    set({ currentPage: 1 })
    get().fetchClients()
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
      const state = get()
      const remainingOnPage = state.clients.filter((c) => c.id !== id).length
      
      if (remainingOnPage === 0 && state.currentPage > 1) {
        set({ currentPage: state.currentPage - 1 })
      }
      
      set((state) => ({
        clients: state.clients.filter((c) => c.id !== id),
        debtors: state.debtors.filter((c) => c.id !== id)
      }))
      
      get().fetchClients()
    }
    return success
  }
}))

