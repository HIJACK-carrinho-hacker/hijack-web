import { expect, test } from '@playwright/test'
import { loginAs, resetEnvironment } from './helpers.ts'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ browser }) => {
  await resetEnvironment(browser, 'dual')
})

test.afterAll(async ({ browser }) => {
  await resetEnvironment(browser, 'dual')
})

test('tela de entrada mostra a dica da senha fraca e erro neutro', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Modo simulado: a senha é 1234')).toBeVisible()
  await loginAs(page, { name: 'Ana', role: 'Piloto', car: 'Carrinho A', password: '0000' })
  await expect(page.getByRole('alert')).toHaveText('Não foi possível entrar. Confira o carrinho e a senha.')
  await expect(page).toHaveURL('/')
})

test('piloto e hacker entram e são levados às suas telas', async ({ browser }) => {
  const pilot = await (await browser.newContext()).newPage()
  const hacker = await (await browser.newContext()).newPage()
  await loginAs(pilot, { name: 'Ana', role: 'Piloto', car: 'Carrinho A' })
  await expect(pilot).toHaveURL('/pilot')
  await loginAs(hacker, { name: 'Bruno', role: 'Hacker', car: 'Carrinho B' })
  await expect(hacker).toHaveURL('/hacker')
  await expect(hacker.getByText('Esta é uma simulação no servidor, não uma invasão de rede.')).toBeVisible()
})

test('vaga ocupada é recusada', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage()
  const b = await (await browser.newContext()).newPage()
  await loginAs(a, { name: 'Ana', role: 'Piloto', car: 'Carrinho A' })
  await expect(a).toHaveURL('/pilot')
  await loginAs(b, { name: 'Bia', role: 'Piloto', car: 'Carrinho A' })
  await expect(b.getByRole('alert')).toContainText('vaga já está ocupada')
})

test('troca de senha: piloto é desconectado, senha antiga falha e a nova funciona', async ({ browser }) => {
  const pilot = await (await browser.newContext()).newPage()
  const hacker = await (await browser.newContext()).newPage()
  await loginAs(pilot, { name: 'Ana', role: 'Piloto', car: 'Carrinho A' })
  await expect(pilot).toHaveURL('/pilot')
  await loginAs(hacker, { name: 'Bruno', role: 'Hacker', car: 'Carrinho A' })
  await expect(hacker).toHaveURL('/hacker')

  await hacker.getByRole('tab', { name: 'Defesa' }).click()
  await hacker.getByLabel('Senha atual').fill('1234')
  await hacker.getByLabel('Nova senha').fill('Carrinho2026')
  await hacker.getByLabel('Confirmar').fill('Carrinho2026')
  await hacker.getByRole('button', { name: 'Trocar senha' }).click()
  await expect(hacker.getByText('Senha forte ativa')).toBeVisible()

  await expect(pilot).toHaveURL('/')
  await expect(pilot.getByText(/senha do carrinho alterada/)).toBeVisible()
  await expect(pilot.getByText('Modo simulado: a senha é 1234')).toHaveCount(0)

  await loginAs(pilot, { name: 'Ana', role: 'Piloto', car: 'Carrinho A', password: '1234' })
  await expect(pilot.getByRole('alert')).toBeVisible()
  await loginAs(pilot, { name: 'Ana', role: 'Piloto', car: 'Carrinho A', password: 'Carrinho2026' })
  await expect(pilot).toHaveURL('/pilot')
  await expect(hacker).toHaveURL('/hacker')
})
