import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
const image = process.argv[2]
assert(image, 'Image argument required')
const name = `atchooo-smoke-${process.pid}`
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim()
try {
  docker('run', '-d', '--name', name, '-p', '127.0.0.1::3000', '-e', 'ATCHOOO_ADMIN_PASSWORD=smoke-test-only', '-e', 'ATCHOOO_SESSION_SECRET=smoke-test-only-secret-at-least-32-characters', image)
  const port = JSON.parse(docker('inspect', name))[0].NetworkSettings.Ports['3000/tcp'][0].HostPort
  const base = `http://127.0.0.1:${port}`
  let ready = false
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`${base}/api/private/editor`)).ok) { ready = true; break } } catch { /* wait for startup */ }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  assert(ready, 'SQLite-backed endpoint did not start')
  const snapshot = { widgets: [], profile: { name: 'persistence-smoke', description: 'CI only' } }
  const saved = await fetch(`${base}/api/private/editor`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: 0, snapshot }) })
  assert(saved.ok, 'SQLite write failed')
  const html = await (await fetch(base)).text()
  const asset = html.match(/src="([^" ]+\/_next\/static\/[^" ]+|\/_next\/static\/[^" ]+)"/)
  assert(asset, 'No standalone JS assets found')
  assert((await fetch(new URL(asset[1], base))).ok, 'Static asset unavailable')
  docker('exec', name, 'ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'color=size=64x96:rate=1', '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '/tmp/smoke.mp4')
  docker('exec', name, 'node', '-e', "require('sharp'); require('node:sqlite'); require('fs').accessSync(process.env.BW_CLI_PATH)")
  docker('restart', name)
  let persisted = false
  for (let i = 0; i < 30; i++) {
    try {
      const data = await (await fetch(`${base}/api/private/editor`)).json()
      if (data.snapshot?.profile?.name === 'persistence-smoke') { persisted = true; break }
    } catch { /* wait for restart */ }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  assert(persisted, 'SQLite data missing after restart')
  console.log('Standalone assets, SQLite write/restart persistence, Sharp, FFmpeg/libx264 and Bitwarden CLI path passed.')
} finally {
  try { docker('logs', name) } catch { /* container may not exist */ }
  try { docker('rm', '-f', '-v', name) } catch { /* cleanup */ }
}
