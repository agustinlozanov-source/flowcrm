import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  org: null,
  role: null,
  memberData: null,
  loading: true,

  setUser: (user) => set({ user }),
  setOrg: (org) => set({ org }),
  setRole: (role) => set({ role }),
  setMemberData: (memberData) => set({ memberData }),
  setLoading: (loading) => set({ loading }),

  reset: () => set({ user: null, org: null, role: null, memberData: null, loading: false }),
}))
