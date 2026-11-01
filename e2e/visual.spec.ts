import { expect, test } from '@playwright/test'

// Regressão visual: início, detalhe, carrinho e pagamento (nos 3 viewports do playwright.config).
// Baselines: `npm run test:e2e:update` na primeira vez (ou ao mudar o visual de propósito).
const shot = { animations: 'disabled', maxDiffPixelRatio: 0.02, fullPage: true } as const

test.beforeEach(async ({ page }) => { await page.goto('/?reset=1'); await page.evaluate(() => localStorage.clear()) })

test('início', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('heading', { name: /Emerald|Cosmic|Pixel/ }).first()).toBeVisible()
  await expect(page).toHaveScreenshot('inicio.png', shot)
})
test('detalhe do NFT', async ({ page }) => {
  await page.goto('/nft/2'); await expect(page.getByRole('button', { name: 'Comprar' })).toBeVisible()
  await expect(page).toHaveScreenshot('detalhe.png', shot)
})
test('carrinho e pagamento', async ({ page }) => {
  await page.goto('/login'); await page.getByRole('button', { name: 'Entrar' }).click()
  await page.goto('/nft/2'); await page.getByRole('button', { name: 'Comprar' }).click()
  await expect(page.getByRole('link', { name: /finalizar/i })).toBeVisible()
  await expect(page).toHaveScreenshot('carrinho.png', shot)
  await page.getByRole('link', { name: /finalizar/i }).click()
  await expect(page.getByRole('button', { name: 'Revisar pedido' })).toBeVisible()
  await expect(page).toHaveScreenshot('pagamento.png', shot)
})
