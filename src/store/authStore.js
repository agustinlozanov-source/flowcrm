import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  org: null,
  role: null,
  loading: true,

  setUser: (user) => set({ user }),
  setOrg: (org) => set({ org }),
  setRole: (role) => set({ role }),
  setLoading: (loading) => set({ loading }),

  reset: () => set({ user: null, org: null, role: null, loading: false }),
}))
