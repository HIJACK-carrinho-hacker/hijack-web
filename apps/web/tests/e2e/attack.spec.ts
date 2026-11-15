import { expect, test } from '@playwright/test'
import { carPanel, holdJoystick, loginAs, resetEnvironment } from './helpers.ts'

test.describe.configure({ mode: 'serial' })

test.afterAll(async ({ browser }) => {
  await resetEnvironment(browser, 'dual')
})

test('antes da largada o ataque fica bloqueado', async ({ browser, page }) => {
  await resetEnvironment(browser, 'dual')
  await loginAs(page, { name: 'Bruno', role: 'Hacker', car: 'Carrinho A' })
  await expect(page.getByText('O ataque é liberado quando a partida começar.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Escanear rede' })).toBeDisabled()
})

test('quatro etapas e inversões independentes alteram o carrinho adversário', async ({ browser }) => {
  test.setTimeout(60_000)
  await resetEnvironment(browser, 'dual', 'running')
  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto('/simulator')
  const hacker = await (await browser.newContext()).newPage()
  const pilot = await (await browser.newContext()).newPage()

  await loginAs(hacker, { name: 'Bruno', role: 'Hacker', car: 'Carrinho A' })
  await hacker.getByRole('button', { name: 'Escanear rede' }).click()
  await expect(hacker.getByText('(sua equipe)')).toBeVisible()
  await expect(hacker.getByRole('button', { name: /Carrinho A/ })).toBeDisabled()
  await hacker.getByRole('button', { name: /Carrinho B/ }).click()
  await hacker.getByRole('button', { name: 'Explorar vulnerabilidade' }).click()
  await expect(hacker.getByText(/Relatório simulado/)).toBeVisible()
  await hacker.getByRole('switch', { name: 'Frente ↔ Ré' }).click()
  await expect(hacker.getByText('Ataque ativo em Carrinho B')).toBeVisible()

  await loginAs(pilot, { name: 'Bia', role: 'Piloto', car: 'Carrinho B' })
  await expect(pilot.getByRole('status').filter({ hasText: 'Em demonstração' })).toBeVisible()
  await holdJoystick(pilot, 0, -1)
  await expect(carPanel(viewer, 'Carrinho B').getByRole('img', { name: 'Confirmado: ré, direção centro' })).toBeVisible()
  await expect(hacker.getByText('Comando alterado: frente → ré').first()).toBeVisible()
  await pilot.mouse.up()

  await hacker.getByRole('switch', { name: 'Frente ↔ Ré' }).click()
  await hacker.getByRole('switch', { name: 'Esquerda ↔ Direita' }).click()
  await expect(hacker.getByRole('switch', { name: 'Esquerda ↔ Direita' })).toBeChecked()
  await holdJoystick(pilot, -1, -1)
  await expect(carPanel(viewer, 'Carrinho B').getByRole('img', { name: /^Confirmado: frente, direção \d+% à direita$/ })).toBeVisible()
  await pilot.mouse.up()
  await expect(carPanel(viewer, 'Carrinho B').getByRole('img', { name: 'Confirmado: parado, direção centro' })).toBeVisible()

  await hacker.getByRole('button', { name: 'Desativar ataque' }).click()
  await expect(hacker.getByText('Nenhum ataque ativo')).toBeVisible()
  await holdJoystick(pilot, 0, -1)
  await expect(carPanel(viewer, 'Carrinho B').getByRole('img', { name: 'Confirmado: frente, direção centro' })).toBeVisible()
  await pilot.mouse.up()
})
