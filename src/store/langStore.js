import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useLangStore = create(
  persist(
    (set, get) => ({
      lang: 'es',
      toggleLang: () => set({ lang: get().lang === 'es' ? 'en' : 'es' }),
      setLang: (lang) => set({ lang }),
    }),
    { name: 'flowcrm-lang' }
  )
)
