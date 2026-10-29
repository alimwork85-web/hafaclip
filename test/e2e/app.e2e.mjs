// End-to-end check of the built app (dist/win-unpacked) with Playwright: core operations plus a screenshot of every screen.
// Run: npm run dist, then npm run e2e. Uses a fresh data folder, so real history and the startup entry are never touched.
// Pasting into another app is left out: it sends Ctrl+V to whatever window is in front.
import { _electron as electron } from 'playwright-core'
import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import koffi from 'koffi'

// The app closes the panel when the real cursor is outside it, while Playwright moves only a virtual one;
// so the real cursor is parked inside the window. Moving the mouse during the run can close the panel.
const SetCursorPos = koffi.load('user32.dll').func('bool __stdcall SetCursorPos(int x, int y)')

const root = new URL('../../', import.meta.url).pathname.slice(1)
const shots = join(root, 'test-results')
rmSync(shots, { recursive: true, force: true })
mkdirSync(shots, { recursive: true })

const data = mkdtempSync(join(tmpdir(), 'hafaclip-e2e-'))
mkdirSync(join(data, 'images'))
const png = join(root, 'build', 'icon.png')
copyFileSync(png, join(data, 'images', '0f0f0f0f-1.png'))
const now = Date.now()
const minute = 60000
writeFileSync(join(data, 'settings.json'), JSON.stringify({ language: 'en', launchAtLogin: false }))
writeFileSync(
  join(data, 'items.json'),
  JSON.stringify([
    { id: 'pin', kind: 'text', text: 'Best regards,\nAli Alhumedi', createdAt: now - 50 * minute, pinned: true },
    { id: 'ar', kind: 'text', text: 'مُحَمَّد دفع ١٢٣٤٥ ريالًا للمدرسة', createdAt: now - 1 * minute, pinned: false },
    { id: 'typo', kind: 'text', text: 'hgsghl ugd;l', createdAt: now - 2 * minute, pinned: false },
    { id: 'link', kind: 'text', text: 'https://github.com/alimwork85-web/edge-clipboard', createdAt: now - 3 * minute, pinned: false },
    { id: 'files', kind: 'files', files: ['C:\\Docs\\Report.pdf', 'C:\\Music\\Song.mp3', 'C:\\Video\\Clip.mp4', 'C:\\Docs\\Notes.txt'], createdAt: now - 4 * minute, pinned: false },
    { id: 'img', kind: 'image', image: '0f0f0f0f-1.png', width: 256, height: 256, hash: createHash('sha1').update('x').digest('hex'), createdAt: now - 5 * minute, pinned: false },
    { id: 'long', kind: 'text', text: 'Line one of a long note\nLine two\nLine three\nLine four\nLine five', createdAt: now - 6 * minute, pinned: false }
  ])
)

const errors = []
const results = []
const step = async (name, fn) => {
  try {
    await fn()
    results.push(`PASS ${name}`)
  } catch (err) {
    results.push(`FAIL ${name}: ${err.message.split('\n')[0]}`)
  }
}

const app = await electron.launch({
  executablePath: join(root, 'dist', 'win-unpacked', 'HafaClip.exe'),
  env: { ...process.env, EDGE_CLIPBOARD_DATA: data }
})
const page = await app.firstWindow()
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`))
await page.waitForSelector('.app', { state: 'attached' })
const wait = (ms) => page.waitForTimeout(ms)
const shot = (name) => page.screenshot({ path: join(shots, `${name}.png`) })
const cards = () => page.locator('.list .card')
const clipboardText = () => app.evaluate(({ clipboard }) => clipboard.readText())
const setting = (patch) => page.evaluate((p) => window.panel.updateSettings(p), patch)
const open = async () => {
  const b = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getBounds())
  SetCursorPos(Math.round(b.x + b.width / 2), Math.round(b.y + b.height / 2))
  const { height } = page.viewportSize() ?? (await page.evaluate(() => ({ height: innerHeight })))
  const edge = await page.evaluate(() => document.querySelector('.app').className.includes('edge-right'))
  const width = await page.evaluate(() => innerWidth)
  await page.mouse.move(edge ? width - 2 : 2, height / 2)
  await page.waitForSelector('.app.expanded', { state: 'attached' })
  await wait(350)
}
const tab = (i) => page.locator('.tabs button').nth(i).click()

await step('hovering the screen edge opens the panel', open)
await step('lists all items with pinned first', async () => {
  assert.equal(await cards().count(), 7)
  assert.match(await cards().first().innerText(), /Best regards/)
})
await shot('01-history-en')

await step('search filters and ignores Arabic diacritics', async () => {
  await page.fill('.search', 'محمد')
  assert.equal(await cards().count(), 1)
  await page.fill('.search', 'zzzz')
  assert.equal(await cards().count(), 0)
})
await shot('02-search-empty')
await page.fill('.search', '')

await step('clicking a card copies it', async () => {
  await cards().filter({ hasText: 'github.com' }).click()
  await wait(300)
  assert.equal(await clipboardText(), 'https://github.com/alimwork85-web/edge-clipboard')
})

await step('More shows the whole long text', async () => {
  const card = cards().filter({ hasText: 'Line one' })
  await card.locator('.more-toggle').click()
  assert.match(await card.innerText(), /Line five/)
})
await shot('03-more-expanded')

await step('fix keyboard layout adds the converted text', async () => {
  const card = cards().filter({ hasText: 'hgsghl' })
  await card.hover()
  await card.getByRole('button', { name: 'Fix keyboard layout' }).click()
  await page.waitForSelector('.card-text:text-is("السلام عليكم")')
})

await step('Paste as menu offers both conversions', async () => {
  const card = cards().filter({ hasText: 'ريال' })
  await card.hover()
  await card.getByRole('button', { name: 'Paste as…' }).click()
  assert.equal(await page.locator('.paste-menu button:not([disabled])').count(), 2)
})
await shot('04-paste-as-menu')
await page.mouse.move(200, 30)

await step('pin and unpin', async () => {
  const card = cards().filter({ hasText: 'github.com' })
  await card.hover()
  await card.getByRole('button', { name: 'Pin' }).click()
  await wait(300)
  assert.equal(await page.locator('.card.pinned').count(), 2)
  const pinned = cards().filter({ hasText: 'github.com' })
  await pinned.hover()
  await pinned.getByRole('button', { name: 'Unpin' }).click()
  await wait(300)
  assert.equal(await page.locator('.card.pinned').count(), 1)
})

await step('Ctrl+click two cards, merge, then split', async () => {
  await cards().filter({ hasText: 'السلام عليكم' }).click({ modifiers: ['Control'] })
  await cards().filter({ hasText: 'hgsghl' }).click()
  await shot('05-selection')
  await page.getByRole('button', { name: 'Merge' }).click()
  await page.waitForSelector('.card.kind-group')
  const group = page.locator('.card.kind-group')
  await group.hover()
  await group.getByRole('button', { name: 'Split' }).click()
  await wait(300)
  assert.equal(await page.locator('.card.kind-group').count(), 0)
})

await step('delete removes a card', async () => {
  const before = await cards().count()
  const card = cards().filter({ hasText: 'السلام عليكم' })
  await card.hover()
  await card.getByRole('button', { name: 'Delete' }).click()
  await wait(300)
  assert.equal(await cards().count(), before - 1)
})

await step('keyboard: arrows move focus, Esc closes', async () => {
  await page.focus('.search')
  await page.keyboard.press('ArrowDown')
  assert.ok(await page.evaluate(() => document.activeElement.classList.contains('card')))
  await page.keyboard.press('ArrowUp')
  assert.ok(await page.evaluate(() => document.activeElement.classList.contains('search')))
  await page.keyboard.press('Escape')
  await page.waitForSelector('.app:not(.expanded)', { state: 'attached' })
})
await open()

const tabs = ['all', 'files', 'images', 'videos', 'audio', 'documents', 'text', 'links']
for (const [i, name] of tabs.entries()) {
  await tab(i)
  await wait(250)
  await shot(`06-tab-${i}-${name}`)
}
await step('tabs filter by type', async () => {
  await tab(2)
  assert.equal(await cards().count(), 1) // the image item; no copied file is an image
  await tab(1)
  assert.equal(await cards().count(), 1) // the 4-file copy
})
await tab(0)

await step('emoji search in English and Arabic', async () => {
  await tab(8)
  await page.fill('.emoji-panel .search', 'heart')
  assert.ok((await page.locator('.emoji-grid .emoji').count()) > 10)
  await page.fill('.emoji-panel .search', 'قلب')
  assert.ok((await page.locator('.emoji-grid .emoji').count()) > 10)
})
await shot('07-emoji-search')
await page.fill('.emoji-panel .search', '')
await shot('08-emoji')

await step('settings open; a limit above the item count applies at once', async () => {
  await page.click('.gear')
  await shot('09-settings-top')
  await page.getByRole('button', { name: '250', exact: true }).click()
  await wait(300)
  assert.equal(await page.locator('.settings-note').count(), 0)
  assert.equal((await page.evaluate(() => window.panel.getSettings())).historyLimit, 250)
  await page.locator('.settings').evaluate((s) => (s.scrollTop = s.scrollHeight))
  await shot('10-settings-bottom')
})

const variants = [
  ['11-arabic', { language: 'ar' }],
  ['12-light', { theme: 'light', language: 'en' }],
  ['13-sand-large-cairo', { theme: 'sand', textSize: 'large', font: 'cairo' }],
  ['14-ocean-compact-narrow', { theme: 'ocean', density: 'compact', panelWidth: 'narrow', textSize: 'small', font: 'plex' }],
  ['15-wide-right-edge', { theme: 'dark', density: 'comfortable', panelWidth: 'wide', textSize: 'medium', font: 'system', edge: 'right' }]
]
for (const [name, patch] of variants) {
  await setting(patch)
  await wait(400)
  await open()
  await tab(0)
  await wait(400)
  await shot(`${name}-list`)
  await page.click('.gear')
  await wait(300)
  await shot(`${name}-settings`)
  await page.click('.gear')
}
await step('arabic layout is right to left', async () => {
  await setting({ language: 'ar' })
  await wait(300)
  assert.equal(await page.evaluate(() => document.documentElement.dir), 'rtl')
})

await step('Clear all asks to confirm and keeps pinned items', async () => {
  await open()
  await page.click('.clear')
  await shot('16-clear-confirm')
  await page.click('.clear')
  await wait(400)
  assert.equal(await cards().count(), 1)
})
await shot('17-after-clear')

await step('no console or page errors', async () => assert.deepEqual(errors, []))
const pid = app.process().pid
await app.close()
await step('quits cleanly (no error dialog keeps it alive)', async () => {
  await new Promise((r) => setTimeout(r, 2500))
  assert.throws(() => process.kill(pid, 0), 'the app process is still running')
})
rmSync(data, { recursive: true, force: true })

if (errors.length) console.log(errors.join('\n') + '\n')
console.log(results.join('\n'))
console.log(`\nScreenshots: ${shots}`)
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0
