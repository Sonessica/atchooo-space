import { randomUUID } from 'node:crypto'
import type { LinkWidgetConfig, WidgetConfig } from '@/bento/widgets/types'
import type { VaultwardenLinkSource } from '@/lib/server/editor-db'

type VaultItem = { id?: unknown; type?: unknown; name?: unknown; login?: { uris?: { uri?: unknown }[] } }
export type VaultLink = { itemId: string; uriIndex: number; title: string; url: string }

function cleanUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    url.search = ''
    url.hash = ''
    if (/\/(auth\/authorize|openid-connect\/auth)$/.test(url.pathname)) url.pathname = '/'
    return url.toString()
  } catch { return null }
}

export function extractVaultLinks(input: unknown): { links: VaultLink[]; skipped: number } {
  if (!Array.isArray(input) || input.length > 10000) throw new Error('Invalid vault response')
  const links: VaultLink[] = []
  let skipped = 0
  for (const item of input as VaultItem[]) {
    if (item.type !== 1 || typeof item.id !== 'string' || typeof item.name !== 'string') continue
    const uris = Array.isArray(item.login?.uris) ? item.login.uris : []
    for (const [uriIndex, entry] of uris.entries()) {
      const url = entry && typeof entry.uri === 'string' ? cleanUrl(entry.uri) : null
      if (!url) { skipped++; continue }
      links.push({ itemId: item.id, uriIndex, title: item.name.trim().slice(0, 200) || new URL(url).hostname, url })
      if (links.length > 1000) throw new Error('Too many vault links')
    }
  }
  const groups = new Map<string, VaultLink[]>()
  for (const link of links) groups.set(link.title, [...(groups.get(link.title) || []), link])
  for (const [title, members] of groups) {
    if (members.length < 2) continue
    const sameUrl = members.every(link => link.url === members[0].url)
    members.forEach((link, index) => { link.title = `${title}（${sameUrl ? '账号' : '链接'} ${index + 1}）` })
  }
  return { links, skipped }
}

export function reconcileVaultLinks(widgets: WidgetConfig[], links: VaultLink[], mappings: VaultwardenLinkSource[] = []) {
  const next = [...widgets]
  const used = new Set<string>()
  const nextMappings: VaultwardenLinkSource[] = []
  let added = 0
  let updated = 0
  let adopted = 0
  for (const source of links) {
    const key = `${source.itemId}:${source.uriIndex}`
    const legacyWidget = next.find(widget => widget.category === 'link' &&
      'vaultwardenSource' in widget && (() => {
        const legacy = (widget as WidgetConfig & { vaultwardenSource?: { itemId: string; uriIndex: number } }).vaultwardenSource
        return !!legacy && `${legacy.itemId}:${legacy.uriIndex}` === key
      })())
    const mapping = mappings.find(item => `${item.itemId}:${item.uriIndex}` === key) ||
      (legacyWidget ? { itemId: source.itemId, uriIndex: source.uriIndex, widgetId: legacyWidget.id,
        sourceTitle: (legacyWidget as WidgetConfig & { vaultwardenSource: { sourceTitle?: string } }).vaultwardenSource.sourceTitle || source.title } : undefined)
    let index = mapping ? next.findIndex(widget => widget.category === 'link' && widget.id === mapping.widgetId) : -1
    let isAdoption = false
    if (index < 0) {
      index = next.findIndex(widget => widget.category === 'link' && !used.has(widget.id) &&
        widget.url === source.url && widget.title === source.title)
      isAdoption = index >= 0
    }
    if (index < 0) {
      const widgetId = `link-${randomUUID()}`
      next.push({ id: widgetId, category: 'link', size: '1x1', platform: 'generic',
        title: source.title, url: source.url, onCanvas: true })
      nextMappings.push({ itemId: source.itemId, uriIndex: source.uriIndex, widgetId, sourceTitle: source.title })
      added++
      continue
    }
    const old = next[index] as LinkWidgetConfig
    const { vaultwardenSource: _legacySource, ...publicOld } = old as LinkWidgetConfig & { vaultwardenSource?: unknown }
    void _legacySource
    used.add(old.id)
    const title = !mapping || old.title === mapping.sourceTitle ? source.title : old.title
    const replacement: LinkWidgetConfig = { ...publicOld, title, url: source.url,
      ...(old.url !== source.url ? { linkHealth: undefined } : {}) }
    nextMappings.push({ itemId: source.itemId, uriIndex: source.uriIndex, widgetId: old.id, sourceTitle: source.title })
    if (isAdoption) adopted++
    if (JSON.stringify(replacement) !== JSON.stringify(old)) {
      next[index] = replacement
      if (!isAdoption) updated++
    }
  }
  return { widgets: next, mappings: nextMappings, added, updated, adopted,
    changed: added + updated + adopted > 0 }
}
