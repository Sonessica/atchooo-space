import assert from 'node:assert/strict'
import { chromium } from 'playwright'

/** Runs only against the isolated CI container, never against NAS user data. */
export async function smokeSections(base) {
  const endpoint = `${base}/api/private/editor?space=bookmarks`
  const snapshot = { profile: { name: 'CI', description: '' }, widgets: [
    { id: 'ci-section', category: 'section', size: '2x2', x: 0, y: 0, title: 'Section smoke\nMultiline', subtitle: 'Subtitle', icon: '📚', fontSize: 36, align: 'center', background: 'glass', backgroundColor: '#ffffff', url: 'https://example.com' },
    { id: 'ci-member', category: 'text', size: '1x1', x: 2, y: 0, content: 'Grouped member', groupId: 'ci-section' },
    { id: 'ci-link', category: 'link', size: '1x1', x: 0, y: 2, url: 'https://example.com', title: 'Hover test', platform: 'generic' },
  ] }
  assert((await fetch(endpoint, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: 0, snapshot }) })).ok)
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1200 }, reducedMotion: 'reduce' })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(`${base}/bookmarks`)
    const section = page.locator('#widget-ci-section')
    const member = page.locator('#widget-ci-member')
    await section.waitFor({ state: 'visible' })
    assert.equal(await section.locator('h2').evaluate(el => getComputedStyle(el).fontSize), '36px')
    assert.equal(await section.locator('h2').evaluate(el => getComputedStyle(el).whiteSpace), 'pre-wrap')
    assert.equal(await section.locator('a[aria-label="打开分区链接"]').getAttribute('href'), 'https://example.com')
    await section.getByTitle('折叠分区', { exact: true }).click()
    await member.waitFor({ state: 'detached' })
    assert.equal((await (await fetch(endpoint)).json()).snapshot.revision, 1, 'Visitor collapse must not write shared data')
    await section.getByTitle('展开分区', { exact: true }).click()
    await member.waitFor({ state: 'visible' })
    const link = page.locator('#widget-ci-link [data-expanded]')
    await link.hover()
    assert.equal(await link.getAttribute('data-expanded'), 'true', 'Link hover regression')
    await page.getByRole('button', { name: 'Edit page', exact: true }).click()
    await section.locator('h2').dblclick()
    await page.getByLabel('主标题（支持换行）', { exact: true }).fill('Updated section\nSecond line')
    await page.getByRole('button', { name: '样式', exact: true }).click()
    await page.getByLabel('水平对齐', { exact: true }).selectOption('right')
    await page.getByRole('button', { name: '关闭编辑面板', exact: true }).click()
    const waitSaved = async predicate => {
      for (let i = 0; i < 100; i++) {
        const value = (await (await fetch(endpoint)).json()).snapshot
        if (predicate(value)) return value
        await new Promise(resolve => setTimeout(resolve, 100))
      }
      throw new Error('Expected UI changes not saved to SQLite')
    }
    await waitSaved(s => s.widgets.find(w => w.id === 'ci-section').align === 'right')
    const before = (await (await fetch(endpoint)).json()).snapshot
    const bounds = await section.boundingBox()
    const handle = await section.locator('[data-section-drag]').boundingBox()
    const step = bounds.width / 390 * 215
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2 - step, handle.y + handle.height / 2, { steps: 12 })
    await page.mouse.up()
    const moved = await waitSaved(s => s.widgets.find(w => w.id === 'ci-section').x === -1)
    assert.equal(moved.widgets.find(w => w.id === 'ci-member').x, 1, 'Member must move with header')
    await page.keyboard.press('Control+z')
    await waitSaved(s => s.widgets.find(w => w.id === 'ci-section').x === before.widgets.find(w => w.id === 'ci-section').x)
    await page.reload()
    await section.waitFor({ state: 'visible' })
    assert.match(await section.locator('h2').innerText(), /Updated section/)
    assert.equal(await section.locator('h2').evaluate(el => getComputedStyle(el).textAlign), 'right')
    assert.deepEqual(errors, [], 'Browser runtime errors')
    console.log('Browser: multiline/style/link, visitor folding, Link hover, editor changes, rigid drag, undo and persisted reload passed.')
  } finally { await browser.close() }
}
