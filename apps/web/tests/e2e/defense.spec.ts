import { expect, test } from '@playwright/test'
import { carPanel, completeAttack, holdJoystick, loginAs, resetEnvironment } from './helpers.ts'

test.describe.configure({ mode: 'serial' })

test.afterAll(async ({ browser }) => {
  await resetEnvironment(browser)
})

test('integridade do defensor bloqueia a inversão; desligar volta a inverter', async ({ browser }) => {
  test.setTimeout(60_000)
  await resetEnvironment(browser, 'running')
  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto('/simulator')
  const attacker = await (await browser.newContext()).newPage()
  const defender = await (await browser.newContext()).newPage()
  const pilot = await (await browser.newContext()).newPage()

  await loginAs(attacker, { name: 'Bruno', role: 'Hacker', car: 'Carrinho A' })
  await completeAttack(attacker, 'Carrinho B', ['Frente ↔ Ré'])
  await loginAs(defender, { name: 'Caio', role: 'Hacker', car: 'Carrinho B' })
  await defender.getByRole('tab', { name: 'Defesa' }).click()
  await loginAs(pilot, { name: 'Bia', role: 'Piloto', car: 'Carrinho B' })
  await expect(pilot.getByRole('status').filter({ hasText: 'Em demonstração' })).toBeVisible()

  await holdJoystick(pilot, 0, -1)
  await expect(carPanel(viewer, 'Carrinho B').getByRole('img', { name: 'Confirmado: ré, direção centro' })).toBeVisible()
  await expect(carPanel(viewer, 'Carrinho B').getByText('COMANDO ALTERADO NO CAMINHO')).toBeVisible()
  await pilot.mouse.up()

  await defender.getByRole('switch', { name: /Desligada|Bloqueando/ }).first().click()
  await expect(defender.getByText('Bloqueando alterações')).toBeVisible()
  await expect(defender.getByRole('img', { name: '2 de 3 camadas demonstradas' })).toHaveCount(0)
  await expect(defender.getByRole('img', { name: '1 de 3 camadas demonstradas' })).toBeVisible()

  await holdJoystick(pilot, 0, -1)
  await expect(carPanel(viewer, 'Carrinho B').getByRole('img', { name: 'Confirmado: frente, direção centro' })).toBeVisible()
  await expect(carPanel(viewer, 'Carrinho B').getByText('COMANDO ALTERADO NO CAMINHO')).toHaveCount(0)
  await expect(attacker.getByText(/Alteração bloqueada pela integridade/).first()).toBeVisible()
  await pilot.mouse.up()

  await defender.getByRole('switch', { name: 'Bloqueando alterações' }).click()
  await expect(defender.getByRole('switch', { name: 'Desligada' }).first()).toBeVisible()
  await holdJoystick(pilot, 0, -1)
  await expect(carPanel(viewer, 'Carrinho B').getByRole('img', { name: 'Confirmado: ré, direção centro' })).toBeVisible()
  await pilot.mouse.up()
})

test('repetição gera exemplo didático sem mover o carrinho', async ({ browser }) => {
  await resetEnvironment(browser, 'running')
  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto('/simulator')
  const defender = await (await browser.newContext()).newPage()
  await loginAs(defender, { name: 'Caio', role: 'Hacker', car: 'Carrinho B' })
  await defender.getByRole('tab', { name: 'Defesa' }).click()
  await expect(defender.getByText('Simulação, não validação no firmware')).toBeVisible()
  await expect(defender.getByText('Simulação, não HMAC')).toBeVisible()
  await defender.locator('#replay').click()
  await expect(defender.getByText('Recusando comandos antigos')).toBeVisible()
  await expect(defender.getByText(/Repetição \(simulada\)/).first()).toBeVisible()
  await expect(carPanel(viewer, 'Carrinho B').getByText('em movimento')).toHaveCount(0)
})
