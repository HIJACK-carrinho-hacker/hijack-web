import { expect, test } from '@playwright/test'
import { adminSecret, carPanel, completeAttack, holdJoystick, loginSingle, resetEnvironment } from './helpers.ts'

test.describe.configure({ mode: 'serial' })

test.afterAll(async ({ browser }) => {
  await resetEnvironment(browser, 'dual')
})

test('com 1 carrinho a entrada oferece só o piloto do Carrinho A e as duas equipes de hacker', async ({ browser, page }) => {
  await resetEnvironment(browser, 'single')
  await page.goto('/')
  await page.getByRole('radio', { name: /Piloto/ }).click()
  await page.getByLabel('Seu carrinho').click()
  await expect(page.getByRole('option')).toHaveText(['Carrinho A'])
  await page.keyboard.press('Escape')
  await page.getByRole('radio', { name: /Hacker/ }).click()
  await page.getByLabel('Sua equipe').click()
  await expect(page.getByRole('option')).toHaveText(['Equipe A — defende o Carrinho A', 'Equipe B — ataca o Carrinho A'])
  await page.getByRole('option', { name: /^Equipe B/ }).click()
  await expect(page.getByLabel('Senha da equipe B')).toBeVisible()
  await expect(page.getByLabel('Nome do carrinho (opcional)')).toHaveCount(0)
})

test('equipe B ataca o Carrinho A e a integridade da equipe A bloqueia', async ({ browser }) => {
  test.setTimeout(60_000)
  await resetEnvironment(browser, 'single', 'running')
  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto('/simulator')
  await expect(viewer.getByText(/^Partida: .+ · 1 carrinho$/)).toBeVisible()
  await expect(carPanel(viewer, 'Carrinho A')).toBeVisible()
  await expect(carPanel(viewer, 'Carrinho B')).toHaveCount(0)

  const defender = await (await browser.newContext()).newPage()
  const attacker = await (await browser.newContext()).newPage()
  const pilot = await (await browser.newContext()).newPage()

  await loginSingle(defender, { name: 'Caio', slot: 'hackerA' })
  await expect(defender.getByRole('note').filter({ hasText: 'equipe A defende' })).toBeVisible()
  await expect(defender.getByRole('button', { name: 'Escanear rede' })).toHaveCount(0)

  await loginSingle(attacker, { name: 'Bruno', slot: 'hackerB' })
  await expect(attacker.getByRole('tab', { name: 'Defesa' })).toHaveCount(0)
  await completeAttack(attacker, 'Carrinho A', ['Frente ↔ Ré'])
  await expect(attacker.getByText('Ataque ativo em Carrinho A')).toBeVisible()

  await loginSingle(pilot, { name: 'Bia', slot: 'pilot' })
  await expect(pilot.getByRole('status').filter({ hasText: 'Em demonstração' })).toBeVisible()
  await holdJoystick(pilot, 0, -1)
  await expect(carPanel(viewer, 'Carrinho A').getByRole('img', { name: 'Confirmado: ré, direção centro' })).toBeVisible()
  await expect(carPanel(viewer, 'Carrinho A').getByText('COMANDO ALTERADO NO CAMINHO')).toBeVisible()
  await pilot.mouse.up()

  await defender.getByRole('tab', { name: 'Defesa' }).click()
  await defender.getByRole('switch', { name: /Desligada|Bloqueando/ }).first().click()
  await expect(defender.getByText('Bloqueando alterações')).toBeVisible()

  await holdJoystick(pilot, 0, -1)
  await expect(carPanel(viewer, 'Carrinho A').getByRole('img', { name: 'Confirmado: frente, direção centro' })).toBeVisible()
  await expect(attacker.getByText(/Alteração bloqueada pela integridade/).first()).toBeVisible()
  await pilot.mouse.up()
  await expect(carPanel(viewer, 'Carrinho A').getByRole('img', { name: 'Confirmado: parado, direção centro' })).toBeVisible()
})

test('operador vê o Carrinho B desativado e não troca a topologia durante a partida', async ({ browser, page }) => {
  await resetEnvironment(browser, 'single', 'running')
  await page.goto('/admin')
  const res = await page.request.post('/api/admin/session', { data: { secret: adminSecret() } })
  expect(res.ok()).toBe(true)
  await page.reload()
  const topology = page.getByRole('region', { name: 'Topologia da demonstração' })
  await expect(topology.getByRole('button', { name: '1 carrinho' })).toHaveAttribute('aria-pressed', 'true')
  await expect(topology.getByRole('button', { name: '2 carrinhos' })).toBeDisabled()
  await expect(carPanel(page, 'Carrinho B').getByText('desativado', { exact: true })).toBeVisible()
})
