import { expect, test } from '@playwright/test'

// Cada teste começa de estado isolado: ?reset=1 restaura o seed do banco simulado.
test.beforeEach(async ({ page }) => { await page.goto('/?reset=1'); await page.evaluate(() => localStorage.clear()) })

test('busca, ordenação e paginação vivem na URL e sobrevivem ao refresh', async ({ page }) => {
  await page.goto('/?q=Pixel&sort=price-asc&page=1')
  await expect(page.getByRole('heading', { name: /Pixel Pets/ }).first()).toBeVisible()
  await expect(page).toHaveURL(/q=Pixel/)
  await page.reload()
  await expect(page.getByLabel('Buscar')).toHaveValue('Pixel')
  await page.goto('/?page=2'); await page.goBack(); await page.goForward()
  await expect(page.getByText('Página 2 de')).toBeVisible()
})

test('NFT inexistente mostra estado de erro', async ({ page }) => {
  await page.goto('/nft/9999'); await expect(page.getByRole('alert').filter({ hasText: 'não encontrado' })).toBeVisible()
})

test('preço alterado via Socket.IO atualiza o resumo do carrinho aberto', async ({ page }) => {
  await page.goto('/login'); await page.getByRole('button', { name: 'Entrar' }).click()
  await page.goto('/nft/2'); await page.getByRole('button', { name: 'Comprar' }).click()
  await expect(page.getByRole('heading', { name: 'Carrinho' })).toBeVisible()
  const before = await page.getByRole('main').locator('dt', { hasText: /^Total$/ }).locator('..').textContent()
  await page.evaluate(() => fetch('/api/__mock/nft/2', { method: 'POST', body: JSON.stringify({ priceEth: '9.5', duplicate: true }) }))
  await expect(page.getByRole('status').filter({ hasText: 'NFT 2 atualizado' })).toBeVisible()
  await expect(page.getByRole('main').locator('dt', { hasText: /^Total$/ }).locator('..')).not.toHaveText(before ?? '')
})
