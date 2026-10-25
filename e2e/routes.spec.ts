import { test, expect } from './fixtures'

test('the front page keeps heavy routes out of its initial download and can navigate to the atlas', async ({ page }) => {
  const scripts: Array<Promise<number>> = []
  page.on('response', (response) => {
    if (response.request().resourceType() === 'script' && response.url().endsWith('.js')) {
      scripts.push(response.body().then((body) => body.byteLength))
    }
  })
  await page.goto('/#/')
  await expect(page.locator('.front')).toBeVisible()
  // Uncompressed JS: enough headroom for the shell, too little for the map engine.
  expect((await Promise.all(scripts)).reduce((sum, bytes) => sum + bytes, 0)).toBeLessThan(350_000)
  await page.getByRole('navigation', { name: 'Views' }).getByRole('link', { name: 'Atlas', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Orbital standby' })).toBeVisible()
  await expect(page.getByRole('alert')).toBeHidden()
})

test('a failed route download offers reload and leaves navigation available', async ({ page }) => {
  await page.route('**/assets/AccuracyLab-*.js', (route) => route.abort())
  await page.goto('/#/lab/accuracy')
  await expect(page.getByRole('alert')).toContainText('This page could not be loaded')
  await expect(page.getByRole('button', { name: 'Reload the page' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Views' }).getByRole('link', { name: 'Grid/84', exact: true }).click()
  await expect(page.locator('.front')).toBeVisible()
  await expect(page.getByRole('alert')).toBeHidden()
})

test('lazy study variants and chart routes load and retain the right titles', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const route of ['#/study/siop62-alert/2', '#/study/cuba-62/general', '#/study/britain-80/strath']) {
    await page.goto(`/${route}`)
    await expect(page.getByRole('region', { name: 'Study clock' })).toBeVisible()
    await expect(page.getByRole('alert')).toBeHidden()
  }
  await page.goto('/#/lab/accuracy')
  await expect(page.locator('.lab-hud')).toBeVisible()
  await expect(page).toHaveTitle('Grid/84 · Accuracy lab')
  await page.goto('/#/lab/evidence')
  await expect(page.getByRole('region', { name: 'Study clock' })).toBeVisible()
  await expect(page).toHaveTitle('Grid/84 · Evidence lab')
  expect(errors).toEqual([])
})
