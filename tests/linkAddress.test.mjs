import assert from 'node:assert/strict'
import test from 'node:test'
import { publicAddress } from '../src/lib/server/public-address.ts'

test('link checker rejects private, loopback, documentation, and mapped addresses', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '172.20.1.2', '192.168.1.5', '169.254.169.254', '::1', 'fc00::1', '::ffff:127.0.0.1', '203.0.113.1']) {
    assert.equal(publicAddress(address), false, address)
  }
  for (const address of ['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111']) {
    assert.equal(publicAddress(address), true, address)
  }
})
