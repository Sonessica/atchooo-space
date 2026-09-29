'use client'

import { useEffect, useMemo, useState } from 'react'
import { SPACE_CONFIGS, type SpaceId } from '@/lib/space-config'
import type { LinkWidgetConfig, WidgetConfig } from '@/bento/widgets/types'

type LibraryEntry = { space: SpaceId; link: LinkWidgetConfig }
const HEALTH_LABEL = { ok: '正常', redirected: '已跳转', broken: '失效', unknown: '无法判断' } as const

export function LinkLibraryPanel({ space, widgets, isEditing, onUpdate, onAdd, onClose }: {
  space: SpaceId
  widgets: WidgetConfig[]
  isEditing: boolean
  onUpdate: (id: string, updates: Partial<WidgetConfig>) => void
  onAdd: (widget: WidgetConfig) => void
  onClose: () => void
}) {
  const [remote, setRemote] = useState<LibraryEntry[]>([])
  const [query, setQuery] = useState('')
  const [collection, setCollection] = useState('')
  const [tag, setTag] = useState('')
  const [healthFilter, setHealthFilter] = useState('')
  const [checking, setChecking] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')
  const [vaultPassword, setVaultPassword] = useState('')
  const [needsLogin, setNeedsLogin] = useState(false)

  useEffect(() => {
    let active = true
    void Promise.all(SPACE_CONFIGS.filter(item => item.id !== space).map(async item => {
      const response = await fetch(`/api/private/editor?space=${item.id}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('无法读取其他 Space')
      const data = await response.json() as { snapshot: { widgets?: WidgetConfig[] } | null }
      return (data.snapshot?.widgets || []).filter((widget): widget is LinkWidgetConfig => widget.category === 'link')
        .map(link => ({ space: item.id, link }))
    })).then(groups => { if (active) setRemote(groups.flat()) })
      .catch(() => { if (active) setMessage('其他 Space 的链接暂时无法读取') })
    return () => { active = false }
  }, [space])

  const entries = useMemo(() => [
    ...widgets.filter((widget): widget is LinkWidgetConfig => widget.category === 'link').map(link => ({ space, link })),
    ...remote,
  ], [widgets, remote, space])
  const collections = [...new Set(entries.map(entry => entry.link.collection).filter((value): value is string => !!value))].sort()
  const tags = [...new Set(entries.flatMap(entry => entry.link.tags || []))].sort()
  const filtered = entries.filter(({ link }) => {
    const needle = query.toLowerCase()
    return (!needle || `${link.title || ''} ${link.url} ${(link.tags || []).join(' ')}`.toLowerCase().includes(needle)) &&
      (!collection || (link.collection || '') === collection) &&
      (!tag || (link.tags || []).includes(tag)) &&
      (!healthFilter || (link.linkHealth?.status || 'unchecked') === healthFilter)
  })

  async function checkLinks(links: LinkWidgetConfig[]) {
    if (!links.length || checking) return
    setMessage('')
    setChecking(true)
    try {
      const session = await fetch('/api/private/session', { cache: 'no-store' })
      const auth = await session.json() as { authenticated?: boolean }
      if (!auth.authenticated) { setNeedsLogin(true); setMessage('检查链接需要管理员登录'); return }
      for (let start = 0; start < links.length; start += 8) {
        const batch = links.slice(start, start + 8)
        setMessage(`正在检查 ${start + 1}–${Math.min(start + 8, links.length)} / ${links.length}`)
        const response = await fetch('/api/private/link-check', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: batch.map(link => link.url) }),
        })
        if (!response.ok) throw new Error(`检查失败（${response.status}）`)
        const data = await response.json() as { results: NonNullable<LinkWidgetConfig['linkHealth']>[] }
        batch.forEach((link, index) => onUpdate(link.id, { linkHealth: data.results[index] }))
      }
      setMessage(`已检查 ${links.length} 条链接；结果会随当前 Space 自动保存`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '检查失败')
    } finally { setChecking(false) }
  }

  async function login() {
    const response = await fetch('/api/private/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setPassword('')
    if (!response.ok) { setMessage('管理员密码无效或登录受限'); return }
    setNeedsLogin(false)
    setMessage('已登录，可以检查链接或同步 Vaultwarden')
  }

  async function syncVaultwarden() {
    if (!vaultPassword || syncing) return
    setSyncing(true)
    setMessage('')
    try {
      const session = await fetch('/api/private/session', { cache: 'no-store' })
      const auth = await session.json() as { authenticated?: boolean }
      if (!auth.authenticated) { setNeedsLogin(true); setMessage('同步需要先登录站点管理员'); return }
      const response = await fetch('/api/private/vaultwarden-sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: vaultPassword }),
      })
      setVaultPassword('')
      const data = await response.json() as { error?: string; added?: number; updated?: number; adopted?: number; total?: number; skipped?: number }
      if (!response.ok) throw new Error(data.error || `同步失败（${response.status}）`)
      setMessage(`同步完成：新增 ${data.added}，更新 ${data.updated}，关联已有卡片 ${data.adopted}；共 ${data.total} 条${data.skipped ? `，跳过 ${data.skipped} 条非 HTTPS 链接` : ''}`)
      window.setTimeout(() => window.location.reload(), 1600)
    } catch (error) {
      setVaultPassword('')
      setMessage(error instanceof Error ? error.message : '同步失败')
    } finally { setSyncing(false) }
  }

  const currentLinks = entries.filter(entry => entry.space === space).map(entry => entry.link)

  return <div className="fixed inset-0 z-[110000] flex justify-end bg-black/30" onMouseDown={onClose}>
    <aside className="flex h-full w-full max-w-[680px] flex-col bg-[#F7F7F8] p-5 shadow-2xl" onMouseDown={event => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3">
        <div><h2 className="text-xl font-semibold">链接收藏夹</h2><p className="text-xs text-black/50">四个 Space 共 {entries.length} 条链接；当前 Space {currentLinks.length} 条</p></div>
        <button className="rounded-lg px-3 py-1 text-xl hover:bg-black/5" onClick={onClose} aria-label="关闭收藏夹">×</button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <input className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" value={query} onChange={event => setQuery(event.target.value)} placeholder="搜索标题、URL、标签" />
        <select className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" value={collection} onChange={event => setCollection(event.target.value)}><option value="">所有收藏夹</option>{collections.map(value => <option key={value}>{value}</option>)}</select>
        <select className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" value={tag} onChange={event => setTag(event.target.value)}><option value="">所有标签</option>{tags.map(value => <option key={value}>{value}</option>)}</select>
        <select className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm" value={healthFilter} onChange={event => setHealthFilter(event.target.value)}><option value="">所有检查状态</option><option value="unchecked">未检查</option><option value="ok">正常</option><option value="redirected">已跳转</option><option value="broken">失效</option><option value="unknown">无法判断</option></select>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button disabled={!isEditing || checking || !currentLinks.length} className="rounded-lg bg-black px-3 py-2 text-xs text-white disabled:opacity-40" onClick={() => void checkLinks(currentLinks)}>检查当前 Space 的链接</button>
        {message && <span role="status" className="text-xs text-black/60">{message}</span>}
      </div>
      {isEditing && <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="password" autoComplete="off" value={vaultPassword} onChange={event => setVaultPassword(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs" placeholder="Vaultwarden 主密码（仅本次同步使用）" />
        <button disabled={!vaultPassword || syncing} className="rounded-lg bg-blue-600 px-3 py-2 text-xs text-white disabled:opacity-40" onClick={() => void syncVaultwarden()}>{syncing ? '正在同步…' : '立即同步 Vaultwarden'}</button>
        <span className="w-full text-[11px] text-black/50">同步到 Bookmarks；只同步标题和网址，卡片会公开显示。不会自动删除卡片。</span>
      </div>}
      {needsLogin && <form className="mt-3 flex gap-2" onSubmit={event => { event.preventDefault(); void login() }}><input type="password" value={password} onChange={event => setPassword(event.target.value)} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm" placeholder="管理员密码（ATCHOOO_ADMIN_PASSWORD）" /><button className="rounded-lg bg-black px-3 py-2 text-xs text-white">登录</button></form>}
      <div className="mt-4 flex-1 space-y-2 overflow-auto pb-4">
        {filtered.length === 0 && <p className="p-6 text-center text-sm text-black/50">没有符合条件的链接</p>}
        {filtered.map(({ space: itemSpace, link }) => {
          const local = itemSpace === space
          return <div key={`${itemSpace}:${link.id}`} className="rounded-xl border border-black/5 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{link.title || link.url}</p><a className="block truncate text-xs text-blue-600 hover:underline" href={link.url} target="_blank" rel="noopener noreferrer">{link.url}</a></div><span className="rounded-md bg-black/5 px-2 py-1 text-[10px]">{itemSpace.toUpperCase()}</span></div>
            <div className="mt-2 flex flex-wrap gap-1 text-[11px]"><span className="rounded bg-black/5 px-2 py-1">{link.collection || '未分类'}</span>{(link.tags || []).map(value => <span key={value} className="rounded bg-blue-50 px-2 py-1 text-blue-700">#{value}</span>)}<span title={link.linkHealth?.error || link.linkHealth?.checkedAt || ''} className={`rounded px-2 py-1 ${link.linkHealth?.status === 'broken' ? 'bg-red-50 text-red-700' : 'bg-black/5'}`}>{link.linkHealth ? HEALTH_LABEL[link.linkHealth.status] : '未检查'}{link.linkHealth?.httpStatus ? ` · ${link.linkHealth.httpStatus}` : ''}</span></div>
            {local && isEditing && <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input key={`collection-${link.id}`} className="rounded-lg border border-black/10 px-2 py-1.5 text-xs" defaultValue={link.collection || ''} placeholder="收藏夹名称；留空为未分类" onBlur={event => { const value = event.target.value.trim().slice(0, 64); if (value !== (link.collection || '')) onUpdate(link.id, { collection: value || undefined }) }} />
              <input key={`tags-${link.id}`} className="rounded-lg border border-black/10 px-2 py-1.5 text-xs" defaultValue={(link.tags || []).join(', ')} placeholder="标签，用逗号分隔" onBlur={event => { const values = [...new Set(event.target.value.split(',').map(value => value.trim().slice(0, 32)).filter(Boolean))].slice(0, 12); if (values.join(',') !== (link.tags || []).join(',')) onUpdate(link.id, { tags: values }) }} />
              <button className="rounded-lg border border-black/10 px-2 py-1.5 text-xs hover:bg-black/5" onClick={() => onUpdate(link.id, link.onCanvas === false ? { onCanvas: true, x: undefined, y: undefined } : { onCanvas: false })}>{link.onCanvas === false ? '显示到画布' : '从画布移除（仍在收藏夹公开显示）'}</button>
              <button className="rounded-lg border border-black/10 px-2 py-1.5 text-xs hover:bg-black/5" onClick={() => void checkLinks([link])} disabled={checking}>检查此链接</button>
            </div>}
            {!local && <div className="mt-3 flex gap-2"><button className="rounded-lg border px-2 py-1.5 text-xs" onClick={() => { window.location.assign(SPACE_CONFIGS.find(item => item.id === itemSpace)!.href) }}>前往该 Space 编辑</button>{isEditing && <button className="rounded-lg border px-2 py-1.5 text-xs" onClick={() => onAdd({ ...link, id: `link-${crypto.randomUUID()}`, x: undefined, y: undefined, onCanvas: true })}>复制到当前画布</button>}</div>}
          </div>
        })}
      </div>
    </aside>
  </div>
}
