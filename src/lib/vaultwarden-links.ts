import { randomUUID } from 'node:crypto'
import type { LinkWidgetConfig, WidgetConfig } from '@/bento/widgets/types'

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

export function reconcileVaultLinks(widgets: WidgetConfig[], links: VaultLink[]) {
  const next = [...widgets]
  const used = new Set<string>()
  let added = 0
  let updated = 0
  let adopted = 0
  for (const source of links) {
    const key = `${source.itemId}:${source.uriIndex}`
    let index = next.findIndex(widget => widget.category === 'link' &&
      widget.vaultwardenSource && `${widget.vaultwardenSource.itemId}:${widget.vaultwardenSource.uriIndex}` === key)
    let isAdoption = false
    if (index < 0) {
      index = next.findIndex(widget => widget.category === 'link' && !widget.vaultwardenSource &&
        !used.has(widget.id) && widget.url === source.url && widget.title === source.title)
      isAdoption = index >= 0
    }
    if (index < 0) {
      next.push({ id: `link-${randomUUID()}`, category: 'link', size: '1x1', platform: 'generic',
        title: source.title, url: source.url, onCanvas: true,
        vaultwardenSource: { itemId: source.itemId, uriIndex: source.uriIndex, sourceTitle: source.title } })
      added++
      continue
    }
    const old = next[index] as LinkWidgetConfig
    used.add(old.id)
    const title = !old.vaultwardenSource || old.title === old.vaultwardenSource.sourceTitle ? source.title : old.title
    const replacement: LinkWidgetConfig = { ...old, title, url: source.url,
      ...(old.url !== source.url ? { linkHealth: undefined } : {}),
      vaultwardenSource: { itemId: source.itemId, uriIndex: source.uriIndex, sourceTitle: source.title } }
    if (JSON.stringify(replacement) !== JSON.stringify(old)) {
      next[index] = replacement
      if (isAdoption) adopted++
      else updated++
    }
  }
  return { widgets: next, added, updated, adopted, changed: added + updated + adopted > 0 }
}
