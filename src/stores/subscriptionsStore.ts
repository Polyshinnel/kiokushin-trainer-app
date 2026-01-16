import { create } from 'zustand'
import { subscriptionsApi } from '@/lib/api'
import type { Subscription } from '@/types'

interface SubscriptionsState {
  subscriptions: Subscription[]
  isLoading: boolean
  
  fetchSubscriptions: () => Promise<void>
  createSubscription: (data: any) => Promise<Subscription>
  updateSubscription: (id: number, data: any) => Promise<Subscription>
  deleteSubscription: (id: number) => Promise<boolean>
}

export const useSubscriptionsStore = create<SubscriptionsState>((set) => ({
  subscriptions: [],
  isLoading: false,

  fetchSubscriptions: async () => {
    set({ isLoading: true })
    try {
      const subscriptions = await subscriptionsApi.getAll() as Subscription[]
      set({ subscriptions, isLoading: false })
    } catch (error) {
      console.error('Error fetching subscriptions:', error)
      set({ isLoading: false })
    }
  },

  createSubscription: async (data) => {
    const subscription = await subscriptionsApi.create(data) as Subscription
    set((state) => ({ subscriptions: [...state.subscriptions, subscription] }))
    return subscription
  },

  updateSubscription: async (id, data) => {
    const subscription = await subscriptionsApi.update(id, data) as Subscription
    set((state) => ({
      subscriptions: state.subscriptions.map((s) => (s.id === id ? subscription : s))
    }))
    return subscription
  },

  deleteSubscription: async (id) => {
    const success = await subscriptionsApi.delete(id) as boolean
    if (success) {
      set((state) => ({
        subscriptions: state.subscriptions.filter((s) => s.id !== id)
      }))
    }
    return success
  }
}))

