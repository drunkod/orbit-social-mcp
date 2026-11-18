import { chromium } from 'playwright'
const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
})
const page = await browser.newPage()
const issues: string[] = []
page.on('pageerror', e => issues.push('page: ' + e.message))
page.on('console', m => { if (m.type() === 'error') issues.push('console: ' + m.text().slice(0,200)) })
try {
  await page.goto('https://tests-macbook-air.tail70b8a.ts.net:10000/music/studio', { waitUntil: 'domcontentloaded' })
  for (const sec of [0, 4, 9, 18]) {
    if (sec) await page.waitForTimeout(sec * 1000)
    const info = await page.evaluate(() => {
      const service = (window as unknown as { __strudel?: { isReady: boolean; isAttached: boolean; isPlaying: boolean; getReplState: () => { code?: string } } }).__strudel
      return {
        studioButtonDisabled: !!document.querySelector('button:disabled'),
        audioServiceExists: !!service,
        ready: !!service?.isReady,
        attached: !!service?.isAttached,
        playing: !!service?.isPlaying,
        loadedCode: service?.getReplState()?.code?.slice(0,120)
      }
    })
    console.log('SNAPSHOT', sec, JSON.stringify(info))
    const enable = page.getByRole('button', { name: 'Enable Audio' })
    if (await enable.isEnabled()) {
      await enable.click()
      await page.waitForTimeout(1600)
      console.log('ENABLED_AUDIO_CLICKED', true)
      break
    }
  }
  console.log('ISSUES', JSON.stringify(issues.slice(0,15)))
} finally { await browser.close() }
