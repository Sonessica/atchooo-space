import 'server-only'

import { lookup } from 'node:dns/promises'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { isIP } from 'node:net'
import { publicAddress } from './public-address'

export type LinkHealth = {
  status: 'ok' | 'redirected' | 'broken' | 'unknown'
  checkedAt: string
  httpStatus?: number
  finalUrl?: string
  error?: string
}

async function resolvePublicHost(hostname: string) {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('Private address')
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new Error('Private address')
  return addresses[0]
}

async function requestHeaders(url: URL, method: 'HEAD' | 'GET'): Promise<{ status: number; location?: string }> {
  const address = await resolvePublicHost(url.hostname)
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method,
      timeout: 8000,
      headers: {
        'User-Agent': 'ATCHOOO-LinkChecker/1.0',
        ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}),
      },
      lookup: (_hostname, options, callback) => {
        if (options.all) {
          (callback as (error: null, addresses: { address: string; family: number }[]) => void)(null, [address])
        } else callback(null, address.address, address.family)
      },
    }, response => {
      const status = response.statusCode || 0
      const location = response.headers.location
      response.destroy()
      resolve({ status, location })
    })
    request.on('timeout', () => request.destroy(new Error('Timeout')))
    request.on('error', reject)
    request.end()
  })
}

export async function checkLink(rawUrl: string): Promise<LinkHealth> {
  const checkedAt = new Date().toISOString()
  try {
    let current = new URL(rawUrl)
    let redirected = false
    for (let hop = 0; hop <= 5; hop++) {
      if (!['http:', 'https:'].includes(current.protocol) || current.username || current.password) throw new Error('Unsupported URL')
      let result = await requestHeaders(current, 'HEAD')
      if ([403, 405, 501].includes(result.status)) result = await requestHeaders(current, 'GET')
      if (result.status >= 300 && result.status < 400 && result.location) {
        if (hop === 5) throw new Error('Too many redirects')
        current = new URL(result.location, current)
        redirected = true
        continue
      }
      if (result.status >= 200 && result.status < 400) {
        return { status: redirected ? 'redirected' : 'ok', checkedAt, httpStatus: result.status, finalUrl: current.toString() }
      }
      if (result.status === 404 || result.status === 410) return { status: 'broken', checkedAt, httpStatus: result.status, finalUrl: current.toString() }
      if (result.status >= 400) return { status: 'unknown', checkedAt, httpStatus: result.status, finalUrl: current.toString(), error: 'Access denied or temporary server error' }
      throw new Error('No HTTP response')
    }
    throw new Error('Too many redirects')
  } catch (error) {
    return { status: 'unknown', checkedAt, error: error instanceof Error ? error.message : 'Request failed' }
  }
}
