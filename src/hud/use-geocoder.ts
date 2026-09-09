import { useCallback, useEffect, useRef, useState } from 'react'
import { searchPhoton } from '../atlas/photon.ts'
import type { AtlasTarget } from '../atlas/target.ts'

export type GeocoderStatus = 'idle' | 'searching' | 'ready' | 'error'

export interface Geocoder {
  query: string
  setQuery: (query: string) => void
  results: AtlasTarget[]
  status: GeocoderStatus
  /** Resolve the current query immediately, returning the results (or an empty list). */
  resolve: () => Promise<AtlasTarget[]>
  clear: () => void
}

const DEBOUNCE_MS = 350

export function useGeocoder(): Geocoder {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AtlasTarget[]>([])
  const [status, setStatus] = useState<GeocoderStatus>('idle')
  const controller = useRef<AbortController | null>(null)
  const latest = useRef('')

  const run = useCallback(async (q: string): Promise<AtlasTarget[]> => {
    controller.current?.abort()
    const trimmed = q.trim()
    latest.current = trimmed
    if (!trimmed) {
      setResults([])
      setStatus('idle')
      return []
    }
    const abort = new AbortController()
    controller.current = abort
    setStatus('searching')
    try {
      const found = await searchPhoton(trimmed, { signal: abort.signal })
      if (abort.signal.aborted) return []
      setResults(found)
      setStatus('ready')
      return found
    } catch (error) {
      if (abort.signal.aborted) return []
      console.warn('Geocoder failed', error)
      setResults([])
      setStatus('error')
      return []
    }
  }, [])

  useEffect(() => {
    if (query.trim() === latest.current) return
    const timer = setTimeout(() => void run(query), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query, run])

  useEffect(() => () => controller.current?.abort(), [])

  const resolve = useCallback(async () => {
    if (query.trim() === latest.current && status === 'ready') return results
    return run(query)
  }, [query, results, run, status])

  const clear = useCallback(() => {
    controller.current?.abort()
    latest.current = ''
    setQuery('')
    setResults([])
    setStatus('idle')
  }, [])

  return { query, setQuery, results, status, resolve, clear }
}
