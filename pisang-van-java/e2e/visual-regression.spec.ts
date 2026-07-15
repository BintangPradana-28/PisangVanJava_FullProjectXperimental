import { expect, test } from '@playwright/test'

test.describe('Visual Regression Testing', () => {
  test('landing page visual check', async ({ page }) => {
    // Navigate to landing page
    await page.goto('/')
    // Wait for the full layout to load
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    // Validate landing page layout matches the golden snapshot
    await expect(page).toHaveScreenshot('landing-page.png', {
      fullPage: true,
      mask: [
        page.locator('.dynamic-time, .countdown-timer'),
        page.locator('#lokasi'),
        page.locator('#gallery')
      ],
      timeout: 15000
    })
  })

  test('special menu page visual check', async ({ page }) => {
    // Navigate to special menu page
    await page.goto('/menu-spesial')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    // Validate menu catalog rendering matches golden snapshot
    await expect(page).toHaveScreenshot('menu-spesial-page.png', {
      fullPage: true
    })
  })

  test('about us page visual check', async ({ page }) => {
    // Navigate to about us page
    await page.goto('/tentang-kami')
    await page.waitForLoadState('domcontentloaded')
    await page.waitForLoadState('networkidle')

    // Validate about us layout matches golden snapshot
    await expect(page).toHaveScreenshot('about-us-page.png', {
      fullPage: true
    })
  })
})
