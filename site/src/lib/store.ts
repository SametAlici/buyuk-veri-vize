import { useCallback, useEffect, useState } from 'react'

// Anahtarlar eski siteyle aynı: ilerleme ve en iyi puanlar korunur.
export const read = <T,>(key: string, d: T): T => {
  try {
    const v = localStorage.getItem(key)
    return v == null ? d : (JSON.parse(v) as T)
  } catch {
    return d
  }
}
const write = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* depolama kapalı olabilir */
  }
  window.dispatchEvent(new CustomEvent('vm:store', { detail: key }))
}
export function useStored<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => read(key, initial))
  useEffect(() => {
    const on = (e: Event) => { if ((e as CustomEvent).detail === key) setValue(read(key, initial)) }
    window.addEventListener('vm:store', on)
    return () => window.removeEventListener('vm:store', on)
    // initial değişmez kabul edilir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const set = useCallback((v: T) => { setValue(v); write(key, v) }, [key])
  return [value, set] as const
}
