'use client'

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { EditorProvider, useEditor, type ProfileData } from './EditorContext'
import type { WidgetConfig } from '../widgets/types'
import savingLoader from './SavingLoader.module.css'
import { AtchoooSplash, SPLASH_DURATION_MS } from './AtchoooSplash'
import { DEFAULT_SITE_SETTINGS, normalizeSiteSettings, type SiteSettings } from './siteSettings'
import { useGlobalSettings } from './GlobalSettingsProvider'

type Snapshot = {
  widgets: WidgetConfig[]
  profile: ProfileData
  siteSettings: SiteSettings
}
type Stored = Snapshot & { revision: number; updatedAt: string }
type GateState = 'splash' | 'import' | 'ready' | 'error'
type SaveState = 'saved' | 'saving' | 'error' | 'conflict'
type EditorSpace = 'home' | 'notes' | 'gallery' | 'bookmarks'

const EDITOR_SPACES: EditorSpace[] = ['home', 'notes', 'gallery', 'bookmarks']
const snapshotCache = new Map<EditorSpace, Stored | null>()
const snapshotRequests = new Map<EditorSpace, Promise<Stored | null>>()

const LAYOUT_KEY = 'openbento-widgets'
const PROFILE_KEY = 'openbento-profile'
const defaultProfile: ProfileData = {
  name: 'ATCHOOO',
  description: 'Personal hub',
}

const PersistenceContext = createContext<{ flush: () => Promise<boolean> }>({ flush: async () => true })

export function useEditorPersistence() {
  return useContext(PersistenceContext)
}

function cacheSnapshot(space: EditorSpace, snapshot: Stored | null) {
  snapshotCache.set(space, snapshot)
}

function fetchSnapshot(space: EditorSpace) {
  const running = snapshotRequests.get(space)
  if (running) return running
  const request = fetch(`/api/private/editor?space=${encodeURIComponent(space)}`, { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Load failed: ${response.status}`)
      const data = await response.json() as { snapshot: Stored | null }
      cacheSnapshot(space, data.snapshot)
      return data.snapshot
    })
    .finally(() => { snapshotRequests.delete(space) })
  snapshotRequests.set(space, request)
  return request
}

function normalizeWidgets(value: unknown): WidgetConfig[] {
  if (!Array.isArray(value)) return []
  return value.map((widget) => {
    if (!widget || typeof widget !== 'object') return widget
    const data = widget as Omit<WidgetConfig, 'size'> & { size: WidgetConfig['size'] | 'bar' }
    return data.size === 'bar' ? { ...data, size: '2x1' } : data
  }) as WidgetConfig[]
}

function localSnapshot(): Snapshot | null {
  try {
    const layout = JSON.parse(localStorage.getItem(LAYOUT_KEY) || 'null')
    const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null')
    const widgets = normalizeWidgets(Array.isArray(layout?.desktopWidgets) ? layout.desktopWidgets : layout?.widgets)
    const hasProfile = profile && (profile.name !== defaultProfile.name || profile.description !== defaultProfile.description || profile.avatarUrl)
    if (!widgets.length && !hasProfile) return null
    return {
      widgets,
      profile: {
        name: typeof profile?.name === 'string' ? profile.name : defaultProfile.name,
        description: typeof profile?.description === 'string' ? profile.description : defaultProfile.description,
        ...(typeof profile?.avatarUrl === 'string' ? { avatarUrl: profile.avatarUrl } : {}),
      },
      siteSettings: DEFAULT_SITE_SETTINGS,
    }
  } catch {
    return null
  }
}

function PersistenceSync({ initial, space, children }: { initial: Stored | null; space: string; children: React.ReactNode }) {
  const { widgets, profile, siteSettings } = useEditor()
  const [status, setStatus] = useState<SaveState>('saved')
  const revision = useRef(initial?.revision || 0)
  const latest = useRef<Snapshot>({ widgets, profile, siteSettings })
  const savedHash = useRef(initial ? JSON.stringify({
    widgets: initial.widgets, profile: initial.profile, siteSettings: initial.siteSettings || DEFAULT_SITE_SETTINGS,
  }) : '')
  const running = useRef(false)
  const conflicted = useRef(false)
  const hydrated = useRef(false)

  const save = useCallback(async () => {
    if (running.current || conflicted.current) return
    running.current = true
    try {
      while (JSON.stringify(latest.current) !== savedHash.current) {
        const snapshot = latest.current
        const hash = JSON.stringify(snapshot)
        const startedAt = Date.now()
        setStatus('saving')
        const response = await fetch(`/api/private/editor?space=${encodeURIComponent(space)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin', body: JSON.stringify({ revision: revision.current, snapshot }),
        })
        if (response.status === 409) {
          conflicted.current = true
          setStatus('conflict')
          return
        }
        if (!response.ok) throw new Error(`Save failed: ${response.status}`)
        const result = await response.json() as { snapshot: Stored }
        revision.current = result.snapshot.revision
        savedHash.current = hash
        cacheSnapshot(space as EditorSpace, result.snapshot)
        const remaining = 700 - (Date.now() - startedAt)
        if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining))
      }
      setStatus('saved')
    } catch (error) {
      console.error(error)
      setStatus('error')
    } finally {
      running.current = false
    }
  }, [space])

  const flush = useCallback(async () => {
    // A save may already be processing an older snapshot. Wait for its loop to
    // drain, then make one final pass over the latest in-memory state.
    while (running.current) await new Promise(resolve => window.setTimeout(resolve, 25))
    if (conflicted.current) return false
    if (JSON.stringify(latest.current) !== savedHash.current) await save()
    while (running.current) await new Promise(resolve => window.setTimeout(resolve, 25))
    return !conflicted.current && JSON.stringify(latest.current) === savedHash.current
  }, [save])

  useEffect(() => {
    const timer = setTimeout(() => { hydrated.current = true }, 400)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    latest.current = { widgets, profile, siteSettings }
    const timer = setTimeout(() => {
      if (!hydrated.current) return
      const snapshot = latest.current
      if (!initial && !snapshot.widgets.length &&
          snapshot.profile.name === defaultProfile.name && snapshot.profile.description === defaultProfile.description) return
      if (JSON.stringify(snapshot) !== savedHash.current) void save()
    }, 1500)
    return () => clearTimeout(timer)
  }, [widgets, profile, siteSettings, initial, save])

  let indicator: React.ReactNode = null
  if (status === 'saving') indicator = (
    <div
      role="status"
      aria-label="正在保存到 NAS"
      className="pointer-events-none fixed right-4 top-3 z-[100] bg-transparent p-0 shadow-none ring-0 backdrop-blur-none"
      style={{ background: 'transparent', boxShadow: 'none' }}
    >
      <div className={savingLoader.loader} aria-hidden="true" />
    </div>
  )
  if (status === 'error' || status === 'conflict') indicator = <div role="alert" className="fixed top-4 right-4 z-[100] rounded-xl border border-white/10 bg-black/55 px-4 py-2 text-sm text-white shadow-lg backdrop-blur-md">
    {status === 'error' && <><span>保存失败，修改仍在此浏览器。</span><button className="ml-3 underline" onClick={() => void save()}>重试</button></>}
    {status === 'conflict' && <><span>其他浏览器已更新，请先刷新页面。</span><button className="ml-3 underline" onClick={() => location.reload()}>刷新</button></>}
  </div>
  return <PersistenceContext.Provider value={{ flush }}>{children}{indicator}</PersistenceContext.Provider>
}

function toEditorInitial(snapshot: Stored | null) {
  if (!snapshot) return undefined
  return {
    desktopWidgets: snapshot.widgets,
    mobileWidgets: [] as WidgetConfig[],
    layoutIndependent: { desktop: false, mobile: false },
    profile: snapshot.profile,
    siteSettings: normalizeSiteSettings(snapshot.siteSettings || DEFAULT_SITE_SETTINGS),
  }
}

export function PersistentEditorProvider({
  children,
  space = 'home',
  showSplash = true,
}: {
  children: React.ReactNode
  space?: EditorSpace
  showSplash?: boolean
}) {
  const { settings } = useGlobalSettings()
  const playSplash = showSplash && settings.splashEnabled
  const hasCachedSnapshot = snapshotCache.has(space)
  const [state, setState] = useState<GateState>(hasCachedSnapshot ? 'ready' : 'splash')
  const [message, setMessage] = useState('')
  const [initial, setInitial] = useState<Stored | null>(() => snapshotCache.get(space) ?? null)
  const [draft, setDraft] = useState<Snapshot | null>(null)
  const [splashDone, setSplashDone] = useState(!playSplash)

  const load = useCallback(async () => {
    try {
      if (snapshotCache.has(space)) {
        return
      }
      const snapshot = await fetchSnapshot(space)
      if (snapshot) {
        setInitial(snapshot)
        setState('ready')
      } else {
        const local = space === 'home' ? localSnapshot() : null
        if (local) { setDraft(local); setState('import') }
        else { setInitial(null); setState('ready') }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '无法连接到 NAS 数据库')
      setState('error')
    }
  }, [space])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      for (const candidate of EDITOR_SPACES) {
        if (candidate !== space && !snapshotCache.has(candidate)) {
          void fetchSnapshot(candidate).catch(() => undefined)
        }
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [space])

  async function saveInitial(snapshot: Snapshot) {
    setMessage('')
    try {
      const response = await fetch(`/api/private/editor?space=${encodeURIComponent(space)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revision: 0, snapshot }),
      })
      if (!response.ok) {
        const detail = await response.json().catch(() => null) as { error?: string } | null
        if (response.status === 413) setMessage('卡片数据超过上传上限。原卡片仍在此浏览器，请勿清除浏览器数据。')
        else if (response.status === 409) setMessage('NAS 已有新数据，请刷新页面后再操作。')
        else setMessage(`保存失败（${response.status}）：${detail?.error || '请稍后重试'}。原卡片未删除。`)
        return
      }
      const result = await response.json() as { snapshot: Stored }
      cacheSnapshot(space, result.snapshot)
      setInitial(result.snapshot)
      setState('ready')
    } catch {
      setMessage('无法连接到 NAS。原卡片仍在此浏览器，请稍后重试。')
    }
  }

  const ready = state === 'ready'

  return (
    <>
      {playSplash && !splashDone && (
        <AtchoooSplash onDone={() => { setSplashDone(true) }} />
      )}

      {ready && splashDone && (
        <EditorProvider persistence="external" initialSnapshot={toEditorInitial(initial)}>
          <PersistenceSync initial={initial} space={space}>{children}</PersistenceSync>
        </EditorProvider>
      )}

      {ready && !splashDone && (
        <div className="min-h-screen bg-[#1D4ED8]" aria-hidden="true" />
      )}

      {state === 'import' && splashDone && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#F5F5F7] p-6 text-black">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
            <h1 className="text-2xl font-semibold mb-3">ATCHOOO</h1>
            <p className="mb-4 text-sm text-gray-600">NAS 数据库还是空的，发现当前浏览器有旧卡片。是否一次性导入？</p>
            <button className="w-full rounded-xl bg-black p-3 text-white" onClick={() => { if (draft) void saveInitial(draft) }}>导入本地卡片</button>
            <button className="mt-3 w-full rounded-xl border p-3" onClick={() => void saveInitial({
              widgets: [], profile: defaultProfile, siteSettings: DEFAULT_SITE_SETTINGS,
            })}>从空白开始（旧卡片仍留在此浏览器）</button>
            {message && <p className="mt-4 text-sm text-red-600">{message}</p>}
          </div>
        </div>
      )}

      {state === 'error' && splashDone && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#F5F5F7] p-6 text-black">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl">
            <h1 className="text-2xl font-semibold mb-3">ATCHOOO</h1>
            <p className="mb-4 text-sm text-gray-600">{message || '加载失败'}</p>
            <button className="rounded-xl bg-black px-4 py-3 text-white" onClick={() => void load()}>重试</button>
          </div>
        </div>
      )}
    </>
  )
}

export const _SPLASH_MS = SPLASH_DURATION_MS
