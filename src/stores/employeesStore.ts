import { create } from 'zustand'
import { employeesApi } from '@/lib/api'
import type { Employee } from '@/types'

interface EmployeesState {
  employees: Employee[]
  isLoading: boolean
  error: string | null
  
  fetchEmployees: () => Promise<void>
  createEmployee: (data: { full_name: string; birth_year?: number; phone?: string; login?: string; password?: string }) => Promise<Employee>
  updateEmployee: (id: number, data: Partial<Employee>) => Promise<Employee>
  deleteEmployee: (id: number) => Promise<boolean>
}

export const useEmployeesStore = create<EmployeesState>((set, get) => ({
  employees: [],
  isLoading: false,
  error: null,

  fetchEmployees: async () => {
    set({ isLoading: true, error: null })
    try {
      const employees = await employeesApi.getAll() as Employee[]
      set({ employees, isLoading: false })
    } catch (error) {
      set({ error: 'Ошибка загрузки сотрудников', isLoading: false })
    }
  },

  createEmployee: async (data) => {
    const employee = await employeesApi.create(data) as Employee
    set((state) => ({ employees: [...state.employees, employee] }))
    return employee
  },

  updateEmployee: async (id, data) => {
    const employee = await employeesApi.update(id, data) as Employee
    set((state) => ({
      employees: state.employees.map((e) => (e.id === id ? employee : e))
    }))
    return employee
  },

  deleteEmployee: async (id) => {
    const success = await employeesApi.delete(id) as boolean
    if (success) {
      set((state) => ({
        employees: state.employees.filter((e) => e.id !== id)
      }))
    }
    return success
  }
}))

