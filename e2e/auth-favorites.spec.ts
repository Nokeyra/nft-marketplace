import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => { await page.goto('/?reset=1'); await page.evaluate(() => localStorage.clear()) })

test('cadastro trata e-mail já existente e cria conta nova', async ({ page }) => {
  await page.goto('/register')
  await page.getByLabel(/^Nome de usuário/).fill('ana_teste'); await page.getByLabel(/^E-mail/).fill('ana@demo.dev'); await page.getByLabel(/^Senha/).fill('senha1234'); await page.getByLabel(/^Confirmar senha/).fill('senha1234')
  await page.getByRole('button', { name: 'Criar conta' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'já está cadastrado' })).toBeVisible()
  await page.getByLabel(/^E-mail/).fill('nova@demo.dev'); await page.getByRole('button', { name: 'Criar conta' }).click()
  await page.goto('/profile'); await expect(page.getByRole('heading', { name: 'Perfil do colecionador' })).toBeVisible() // sessão ativa (o cabeçalho com "Sair" não existe no mobile)
})

test('favorito persiste e a falha da API faz rollback', async ({ page }) => {
  await page.goto('/login'); await page.getByRole('button', { name: 'Entrar' }).click()
  await page.goto('/nft/2'); await page.getByRole('button', { name: /Favoritar/ }).click()
  await expect(page.getByRole('button', { name: /Favoritado/ })).toBeVisible()
  await page.reload(); await expect(page.getByRole('button', { name: /Favoritado/ })).toBeVisible()
  await page.evaluate(() => localStorage.setItem('mock-scenario', 'favorite-fail'))
  await page.getByRole('button', { name: /Favoritado/ }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Favoritado/ })).toBeVisible() // voltou ao estado anterior
})
