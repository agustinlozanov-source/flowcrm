import { useLangStore } from '@/store/langStore'
import { translations } from '@/lib/i18n'

export function useLang() {
  const { lang, toggleLang, setLang } = useLangStore()
  const t = (key) => translations[lang]?.[key] ?? translations['es'][key] ?? key
  return { lang, toggleLang, setLang, t }
}
