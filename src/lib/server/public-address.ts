import { isIP } from 'node:net'

/** Permit globally routable addresses only. Every resolved address is checked before a request. */
export function publicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number)
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 ||
      a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 ||
      a === 192 && b === 0 && c === 0 || a === 192 && b === 0 && c === 2 ||
      a === 198 && (b === 18 || b === 19 || b === 51 && c === 100) ||
      a === 203 && b === 0 && c === 113)
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase()
    return /^2[0-9a-f]{3}:/.test(normalized) && !normalized.startsWith('2001:db8:')
  }
  return false
}
