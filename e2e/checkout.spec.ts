import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => { await page.goto('/?reset=1'); await page.evaluate(() => localStorage.clear()) })

async function toReview(page: Page) {
  await page.goto('/login'); await page.getByRole('button', { name: 'Entrar' }).click()
  await page.goto('/nft/2'); await page.getByRole('button', { name: 'Comprar' }).click()
  await page.getByRole('link', { name: /finalizar/i }).click()
  await page.getByLabel(/^Rede/).selectOption('ethereum')
  await page.getByLabel(/^Tipo de carteira/).selectOption('MetaMask')
  await page.getByLabel(/^Código de indicação/).fill('KURIO2026')
  await page.getByLabel(/^Nome ENS/).fill('ana-colecionadora')
  await page.getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText('Conectada', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Revisar pedido' }).click()
}

test('compra completa até o recibo confirmado', async ({ page }) => {
  await toReview(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('heading', { name: /Pedido confirmado/ })).toBeVisible({ timeout: 10_000 })
  await page.goto('/cart'); await expect(page.getByText('Seu carrinho está vazio')).toBeVisible()
})

test('pagamento recusado preserva os itens do carrinho', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('mock-scenario', 'pay-declined'))
  await toReview(page)
  await page.getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(page.getByRole('heading', { name: 'Pedido recusado' })).toBeVisible({ timeout: 10_000 })
  await page.goto('/cart'); await expect(page.getByRole('main').getByRole('listitem').filter({ hasText: /Neon Skies/ }).first()).toBeVisible()
})

test('preço alterado durante a revisão exige nova confirmação', async ({ page }) => {
  await toReview(page)
  await page.evaluate(() => fetch('/api/__mock/nft/2', { method: 'POST', body: JSON.stringify({ priceEth: '9.5' }) }))
  await expect(page.getByText('Os valores mudaram')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeDisabled()
  await page.getByRole('button', { name: 'Aceitar novos valores' }).click()
  await expect(page.getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
})
