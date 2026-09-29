import { NextResponse } from 'next/server'
import { isAuthenticated, sameOrigin } from '@/lib/server/editor-auth'
import { readEditor, saveEditor } from '@/lib/server/editor-db'
import { readVaultwardenItems } from '@/lib/server/vaultwarden-client'
import { extractVaultLinks, reconcileVaultLinks } from '@/lib/vaultwarden-links'
import type { WidgetConfig } from '@/bento/widgets/types'

export const runtime = 'nodejs'
export const maxDuration = 180

export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await isAuthenticated())) {
    return NextResponse.json({ error: 'Admin session required' }, { status: 403 })
  }
  const body = await request.json().catch(() => null) as { password?: unknown } | null
  if (typeof body?.password !== 'string' || body.password.length < 1 || body.password.length > 256) {
    return NextResponse.json({ error: 'Vaultwarden password required' }, { status: 400 })
  }
  try {
    const { links, skipped } = extractVaultLinks(await readVaultwardenItems(body.password))
    if (!links.length) return NextResponse.json({ error: 'No supported HTTPS links found' }, { status: 422 })
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = readEditor('bookmarks')
      if (!before) return NextResponse.json({ error: 'Bookmarks Space is unavailable' }, { status: 503 })
      const result = reconcileVaultLinks(before.widgets as WidgetConfig[], links)
      if (!result.changed) return NextResponse.json({ added: 0, updated: 0, adopted: 0,
        skipped, total: links.length }, { headers: { 'Cache-Control': 'no-store' } })
      const saved = saveEditor({ widgets: result.widgets, profile: before.profile, siteSettings: before.siteSettings }, before.revision, 'bookmarks')
      if (saved !== 'conflict') return NextResponse.json({ added: result.added, updated: result.updated,
        adopted: result.adopted, skipped, total: links.length }, { headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json({ error: 'Bookmarks changed during sync; retry' }, { status: 409 })
  } catch {
    return NextResponse.json({ error: 'Vaultwarden sync failed. Check the master password and service connection.' }, { status: 502 })
  }
}
