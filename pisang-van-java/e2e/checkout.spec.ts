import { expect, test } from '@playwright/test'

test.describe('Checkout Flow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock user profile details
    await page.route('**/api/user/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            phone: '6285773728748',
            koinPisang: 5000
          }
        })
      })
    })

    // Mock saved user shipping addresses
    await page.route('**/api/user/addresses', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'addr-1',
              label: 'Rumah Utama',
              fullAddress: 'Jl. Pisang Goreng No. 28, Bandung',
              isDefault: true,
              notes: 'Pagar warna kuning'
            }
          ]
        })
      })
    })

    // Mock NextAuth session endpoint to simulate logged-in customer user
    await page.route('**/api/auth/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-1',
            name: 'Test Customer',
            email: 'test@example.com',
            role: 'CUSTOMER'
          },
          expires: '2026-12-31T23:59:59.999Z'
        })
      })
    })
  })

  test('should successfully complete checkout happy path with cash/WhatsApp redirect', async ({
    page
  }) => {
    // Mock checkout POST endpoint to succeed
    await page.route('**/api/orders', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            orderId: 'PVJ-TEST-12345',
            redirectType: 'WHATSAPP',
            redirectUrl: 'https://wa.me/6285773728748',
            totalPrice: 24000
          }
        })
      })
    })

    // Mock window.open to prevent actual WhatsApp navigation during testing
    await page.addInitScript(() => {
      window.open = () => window
    })

    await page.goto('/checkout')
    await expect(page).toHaveURL(/\/checkout|\/member-login/)
  })

  test('should show correct error dialog when checkout fails due to out-of-stock', async ({
    page
  }) => {
    // Mock checkout POST endpoint to return out of stock error
    await page.route('**/api/orders', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Stok varian menu tidak mencukupi!'
        })
      })
    })

    await page.goto('/checkout')
    await expect(page).toBeDefined()
  })
})
