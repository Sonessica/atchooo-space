import assert from 'node:assert/strict'
import test from 'node:test'
import { parseLinkImport } from '../src/bento/widgets/link/importLinks.ts'

test('CSV keeps separate accounts on one platform and handles quoted names', () => {
  const rows = parseLinkImport('url,title,backgroundImage\nhttps://github.com/alice,"Alice, work",https://example.com/a.jpg\nhttps://github.com/bob,Bob,')
  assert.equal(rows.length, 2)
  assert.equal(rows[0].title, 'Alice, work')
  assert.equal(rows[1].url, 'https://github.com/bob')
})

test('JSON accepts optional manual background and rejects unsafe URLs', () => {
  assert.equal(parseLinkImport('[{"url":"https://example.com/a","backgroundImage":"https://example.com/a.jpg"}]')[0].backgroundImage, 'https://example.com/a.jpg')
  assert.throws(() => parseLinkImport('[{"url":"javascript:alert(1)"}]'), /HTTP\/HTTPS/)
})
