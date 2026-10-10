import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCanvasDrop, resolveCanvasResize, isValidCanvasLayout, autoLayoutWidgets } from '../src/bento/editor/canvasPlacement.ts'
import { setSectionMembers, removeSectionWidgets, nearbySectionMembers, sectionMoveIds, sectionMembersInRect } from '../src/bento/editor/sectionGroups.ts'

const card = (id, size, x, y, groupId) => ({ id, category: 'image', src: '', size, x, y, groupId })
const header = (id, x, y) => ({ id, category: 'section', title: id, size: '2x1', x, y })
const get = (ws, id) => ws.find(w => w.id === id)
const delta = (ws, a, b) => [get(ws, a).x - get(ws, b).x, get(ws, a).y - get(ws, b).y]

test('mixed-size section moves rigidly and pushes all direct blockers', () => {
  const ws = [header('s', -4, 2), card('a', '2x2', -4, 3, 's'), card('b', '1x2', -2, 3, 's'), card('x', '1x1', 0, 3), card('y', '1x1', 1, 3)]
  const next = resolveCanvasDrop(ws, 's', 0, 2, false)
  assert.equal(get(next, 's').x, 0)
  assert.deepEqual(delta(next, 'a', 's'), delta(ws, 'a', 's'))
  assert.deepEqual(delta(next, 'b', 's'), delta(ws, 'b', 's'))
  assert(isValidCanvasLayout(next, false))
})
test('pushed external section retains its own relative geometry', () => {
  const ws = [header('s', -4, 2), card('a', '1x1', -4, 3, 's'), header('t', 0, 2), card('b', '2x2', 0, 3, 't')]
  const next = resolveCanvasDrop(ws, 's', 0, 2, false)
  assert.deepEqual(delta(next, 'b', 't'), delta(ws, 'b', 't'))
  assert(isValidCanvasLayout(next, false))
})
test('group bounding-box gaps remain free', () => {
  const ws = [header('s', -4, 2), card('a', '1x1', -1, 4, 's'), card('gap', '1x1', 2, 3)]
  const next = resolveCanvasDrop(ws, 's', 0, 2, false)
  assert.equal(get(next, 'gap').x, 2)
  assert.equal(get(next, 'gap').y, 3)
  assert(isValidCanvasLayout(next, false))
})
test('locked members and locked external blockers cancel entire move', () => {
  const ws = [header('s', -4, 2), { ...card('a', '1x1', -4, 3, 's'), locked: true }, card('x', '1x1', 0, 2)]
  assert.deepEqual(resolveCanvasDrop(ws, 's', 0, 2, false), ws)
  const other = ws.map(w => ({ ...w, locked: w.id === 'x' }))
  assert.deepEqual(resolveCanvasDrop(other, 's', 0, 2, false), other)
})
test('search collision rejects group move atomically', () => {
  const ws = [header('s', -4, 2), card('a', '2x1', -4, 3, 's')]
  assert.deepEqual(resolveCanvasDrop(ws, 's', 0, 0, true), ws)
})
test('member moves independently without detaching ownership', () => {
  const ws = [header('s', 0, 2), card('a', '1x1', 0, 3, 's')]
  const next = resolveCanvasDrop(ws, 'a', 4, 4, false)
  assert.deepEqual(get(next, 's'), get(ws, 's'))
  assert.equal(get(next, 'a').groupId, 's')
  assert.deepEqual([...sectionMoveIds(ws, 's')], ['s', 'a'])
})
test('folded section slots still prevent overlap; resize preserves valid layout', () => {
  const ws = [{ ...header('s', 0, 2), collapsed: true }, card('a', '1x1', 0, 3, 's'), card('b', '1x1', 4, 4)]
  assert(isValidCanvasLayout(resolveCanvasDrop(ws, 'b', 0, 3, false), false))
  assert(isValidCanvasLayout(resolveCanvasResize(ws, 's', '2x2', false), false))
})
test('auto-layout preserves group relative positions', () => {
  const ws = [header('s', -4, 2), card('a', '2x2', -4, 3, 's'), card('x', '1x1', 10, 10)]
  for (const mode of ['balanced', 'rows', 'columns', 'compact']) {
    const next = autoLayoutWidgets(ws, mode, true)
    assert(isValidCanvasLayout(next, true))
    assert.deepEqual(delta(next, 'a', 's'), delta(ws, 'a', 's'))
  }
})
test('membership is explicit, unique, non-nested and excludes library-only links', () => {
  const ws = [header('s', 0, 0), header('t', 5, 0), card('a', '1x1', 0, 1, 't'), { id: 'l', category: 'link', onCanvas: false }]
  const next = setSectionMembers(ws, 's', ['a', 't', 'l'])
  assert.equal(get(next, 'a').groupId, 's')
  assert.equal(get(next, 't').groupId, undefined)
  assert.equal(get(next, 'l').groupId, undefined)
  assert.equal(get(removeSectionWidgets(next, ['s']), 'a').groupId, undefined)
})
test('nearby preview includes only fully contained cards and needs explicit apply', () => {
  const ws = [header('s', 0, 0), card('a', '1x1', 0, 1), card('b', '2x1', 2, 1), card('c', '1x1', 0, 2, 'other')]
  assert.deepEqual(nearbySectionMembers(ws, 's', 3, 3), ['a'])
  assert.equal(get(ws, 'a').groupId, undefined)
  assert.deepEqual(sectionMembersInRect(ws, 's', { left: 0, top: 1, right: 3, bottom: 4 }), ['a'])
})

test('repeated mixed group moves and resizes preserve the full occupancy invariant', () => {
  let ws = [header('s', -4, 2), card('a', '2x2', -4, 3, 's'), card('b', '1x2', -2, 3, 's'), header('t', 4, 2), card('c', '2x1', 4, 3, 't'), ...Array.from({ length: 12 }, (_, i) => card(`x${i}`, '1x1', i % 6, 7 + Math.floor(i / 6)))]
  for (let i = 0; i < 100; i++) {
    const id = i % 3 === 0 ? 's' : i % 3 === 1 ? 't' : `x${i % 12}`
    const before = delta(ws, 'a', 's')
    ws = resolveCanvasDrop(ws, id, (i * 7) % 13 - 6, (i * 3) % 9 + 1, true)
    assert(isValidCanvasLayout(ws, true))
    assert.deepEqual(delta(ws, 'a', 's'), before)
  }
})
