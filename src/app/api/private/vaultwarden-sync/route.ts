import { NextResponse } from 'next/server'
import { isAuthenticated, sameOrigin } from '@/lib/server/editor-auth'
import { readEditor, readVaultwardenLinkSources, saveEditor, saveVaultwardenLinkSources } from '@/lib/server/editor-db'
import { readVaultwardenItems } from '@/lib/server/vaultwarden-client'
import { extractVaultLinks, reconcileVaultLinks } from '@/lib/vaultwarden-links'
import type { WidgetConfig } from '@/bento/widgets/types'

export const runtime = 'nodejs'
export const maxDuration = 180

type SelectedSource = { itemId?: unknown; uriIndex?: unknown }

function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 256
}

function selectedLinks(links: ReturnType<typeof extractVaultLinks>['links'], value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) return null
  const wanted = new Set<string>()
  for (const item of value as SelectedSource[]) {
    if (!item || typeof item.itemId !== 'string' || item.itemId.length > 200 ||
        !Number.isSafeInteger(item.uriIndex) || (item.uriIndex as number) < 0) return null
    wanted.add(`${item.itemId}:${item.uriIndex}`)
  }
  const selected = links.filter(link => wanted.has(`${link.itemId}:${link.uriIndex}`))
  return selected.length === wanted.size ? selected : null
}

export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await isAuthenticated())) {
    return NextResponse.json({ error: 'Admin session required' }, { status: 403 })
  }
  const body = await request.json().catch(() => null) as {
    action?: unknown; password?: unknown; selected?: unknown; expectedRevision?: unknown
  } | null
  if (!body || !validPassword(body.password) || !['preview', 'apply'].includes(String(body.action))) {
    return NextResponse.json({ error: 'Invalid sync request' }, { status: 400 })
  }
  try {
    const { links, skipped } = extractVaultLinks(await readVaultwardenItems(body.password))
    if (!links.length) return NextResponse.json({ error: 'No supported HTTPS links found' }, { status: 422 })
    const before = readEditor('bookmarks')
    if (!before) return NextResponse.json({ error: 'Bookmarks Space is unavailable' }, { status: 503 })
    if (body.action === 'preview') {
      return NextResponse.json({ revision: before.revision, skipped,
        links: links.map(link => ({ itemId: link.itemId, uriIndex: link.uriIndex,
          title: link.title, url: link.url })) }, { headers: { 'Cache-Control': 'no-store' } })
    }
    if (!Number.isSafeInteger(body.expectedRevision) || body.expectedRevision !== before.revision) {
      return NextResponse.json({ error: 'Bookmarks changed after preview; preview again' }, { status: 409 })
    }
    const selected = selectedLinks(links, body.selected)
    if (!selected) return NextResponse.json({ error: 'Select 1–20 previewed links' }, { status: 400 })
    const result = reconcileVaultLinks(before.widgets as WidgetConfig[], selected, readVaultwardenLinkSources())
    if (result.changed) {
      const saved = saveEditor({ widgets: result.widgets, profile: before.profile, siteSettings: before.siteSettings }, before.revision, 'bookmarks')
      if (saved === 'conflict') return NextResponse.json({ error: 'Bookmarks changed during sync; preview again' }, { status: 409 })
    }
    saveVaultwardenLinkSources(result.mappings)
    return NextResponse.json({ added: result.added, updated: result.updated,
      adopted: result.adopted, skipped, total: selected.length }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Vaultwarden sync failed. Check the master password and service connection.' }, { status: 502 })
  }
}
