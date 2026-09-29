import assert from 'node:assert/strict'
import test from 'node:test'
import { extractVaultLinks, reconcileVaultLinks } from '../src/lib/vaultwarden-links.ts'

test('extracts only HTTPS links, removes transient auth parameters, and distinguishes accounts', () => {
  const { links, skipped } = extractVaultLinks([
    { id: 'one', type: 1, name: 'QQ', login: { uris: [{ uri: 'https://www.qq.com/' }] } },
    { id: 'two', type: 1, name: 'QQ', login: { uris: [{ uri: 'https://www.qq.com/' }] } },
    { id: 'three', type: 1, name: 'Auth', login: { uris: [{ uri: 'https://example.com/auth/authorize?state=secret#fragment' }, { uri: 'http://example.com' }] } },
    { id: 'note', type: 2, name: 'Note' },
  ])
  assert.equal(skipped, 1)
  assert.equal(links.length, 3)
  assert.deepEqual(links.slice(0, 2).map(link => link.title), ['QQ（账号 1）', 'QQ（账号 2）'])
  assert.equal(links[2].url, 'https://example.com/')
})

test('adopts existing cards, preserves manual appearance, and remains idempotent', () => {
  const source = [{ itemId: 'one', uriIndex: 0, title: 'QQ', url: 'https://www.qq.com/' }]
  const old = [{ id: 'existing', category: 'link', size: '1x1', platform: 'generic', title: 'QQ',
    url: 'https://www.qq.com/', backgroundImage: '/media/custom.webp', collection: 'Personal', onCanvas: false }]
  const first = reconcileVaultLinks(old, source)
  assert.equal(first.adopted, 1)
  assert.equal(first.added, 0)
  assert.equal(first.widgets[0].backgroundImage, '/media/custom.webp')
  assert.equal(first.widgets[0].onCanvas, false)
  assert.equal(reconcileVaultLinks(first.widgets, source).changed, false)
  const renamed = reconcileVaultLinks(first.widgets, [{ ...source[0], title: 'QQ Home', url: 'https://www.qq.com/new' }])
  assert.equal(renamed.widgets[0].title, 'QQ Home')
  assert.equal(renamed.widgets[0].url, 'https://www.qq.com/new')
  const customized = reconcileVaultLinks([{ ...first.widgets[0], title: 'My QQ' }], [{ ...source[0], title: 'QQ Home' }])
  assert.equal(customized.widgets[0].title, 'My QQ')
  assert.equal(reconcileVaultLinks(renamed.widgets, []).widgets.length, 1)
})
