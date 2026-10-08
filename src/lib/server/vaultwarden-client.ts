import 'server-only'

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const exec = promisify(execFile)

export async function readVaultwardenItems(masterPassword: string): Promise<unknown> {
  const server = process.env.VAULTWARDEN_URL
  const email = process.env.VAULTWARDEN_EMAIL
  if (!server || !email || new URL(server).protocol !== 'https:') throw new Error('Vaultwarden is not configured')
  const dir = await mkdtemp(join(tmpdir(), 'atchooo-vault-'))
  const cli = process.env.BW_CLI_PATH || '/opt/bitwarden/node_modules/@bitwarden/cli/build/bw.js'
  const env = { ...process.env, BITWARDENCLI_APPDATA_DIR: dir, BW_PASSWORD: masterPassword }
  const run = async (args: string[]) => {
    const result = await exec(process.execPath, [cli, ...args], {
      env, timeout: 45000, maxBuffer: 32 * 1024 * 1024, windowsHide: true,
    })
    return result.stdout.trim()
  }
  try {
    await run(['config', 'server', server])
    let session = ''
    try { session = await run(['login', email, '--passwordenv', 'BW_PASSWORD', '--raw']) }
    catch { /* Some Vaultwarden versions accept login but reject a later key migration. */ }
    if (!session) session = await run(['unlock', '--passwordenv', 'BW_PASSWORD', '--raw'])
    if (!session || session.length > 2000) throw new Error('Vaultwarden authentication failed')
    await run(['sync', '--session', session])
    return JSON.parse(await run(['list', 'items', '--session', session])) as unknown
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
