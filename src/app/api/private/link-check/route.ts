import { NextResponse } from 'next/server'
import { isAuthenticated, sameOrigin } from '@/lib/server/editor-auth'
import { checkLink } from '@/lib/server/check-link'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!sameOrigin(request) || !(await isAuthenticated())) {
    return NextResponse.json({ error: 'Admin session required' }, { status: 403 })
  }
  const body = await request.json().catch(() => null) as { urls?: unknown } | null
  if (!Array.isArray(body?.urls) || body.urls.length < 1 || body.urls.length > 8 ||
    body.urls.some(url => typeof url !== 'string' || url.length > 2048)) {
    return NextResponse.json({ error: 'Provide 1–8 URLs' }, { status: 400 })
  }
  const results = await Promise.all((body.urls as string[]).map(checkLink))
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } })
}
