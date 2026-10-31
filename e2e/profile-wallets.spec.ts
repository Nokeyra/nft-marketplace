import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/?reset=1'); await page.evaluate(() => localStorage.clear())
  await page.goto('/login'); await page.getByRole('button', { name: 'Entrar' }).click()
})

test('perfil: usuário já em uso é recusado e dados válidos são salvos', async ({ page }) => {
  await page.goto('/profile')
  await page.getByLabel(/^Nome de usuário/).fill('bruno'); await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'já em uso' })).toBeVisible()
  await page.getByLabel(/^Nome de usuário/).fill('ana_nova'); await page.getByRole('button', { name: 'Salvar', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Perfil salvo.' })).toBeVisible()
})

test('carteiras: remove a secundária e cadastra outra a partir da principal', async ({ page }) => {
  await page.goto('/profile/wallets')
  await page.getByRole('button', { name: 'Remover' }).click()
  await expect(page.getByText('Você ainda não adicionou uma carteira secundária.')).toBeVisible()
  await page.getByLabel('Igual à carteira principal').check(); await page.getByRole('button', { name: 'Adicionar' }).click()
  await page.getByLabel(/^Apelido da carteira/).last().fill('Reserva')
  await page.getByLabel(/^Endereço da carteira/).last().fill('0x' + 'a'.repeat(40))
  await page.getByRole('button', { name: 'Salvar carteira' }).last().click()
  await expect(page.getByText('Reserva')).toBeVisible()
})

test('lista de interesse mostra o NFT favoritado', async ({ page }) => {
  await page.goto('/nft/2'); await page.getByRole('button', { name: /Favoritar/ }).click()
  await expect(page.getByRole('button', { name: /Favoritado/ })).toBeVisible()
  await page.goto('/profile/favorites'); await expect(page.getByRole('link', { name: /Neon Skies/ })).toBeVisible()
})
