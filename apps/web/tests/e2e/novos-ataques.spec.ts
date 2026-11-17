import { expect, type Page, test } from '@playwright/test'
import { carPanel, completeAttack, holdJoystick, loginAs, resetEnvironment } from './helpers.ts'

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }) => {
  await Promise.all(browser.contexts().map((context) => context.close()))
})

test.afterEach(async ({ browser }) => {
  await Promise.all(browser.contexts().map((context) => context.close()))
})

test.afterAll(async ({ browser }) => {
  await resetEnvironment(browser, 'dual')
})

async function scene(browser: import('@playwright/test').Browser, switches: string[] = []) {
  await resetEnvironment(browser, 'dual', 'running')
  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto('/simulator')
  const attacker = await (await browser.newContext()).newPage()
  const defender = await (await browser.newContext()).newPage()
  const pilot = await (await browser.newContext()).newPage()
  await loginAs(attacker, { name: 'Bruno', role: 'Hacker', car: 'Carrinho A' })
  await completeAttack(attacker, 'Carrinho B', switches)
  await loginAs(defender, { name: 'Caio', role: 'Hacker', car: 'Carrinho B' })
  await defender.getByRole('tab', { name: 'Defesa' }).click()
  await loginAs(pilot, { name: 'Bia', role: 'Piloto', car: 'Carrinho B' })
  await expect(pilot.getByRole('status').filter({ hasText: 'Em demonstração' })).toBeVisible()
  return { viewer, attacker, defender, pilot }
}

const choose = async (page: Page, label: string, option: string) => {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option }).click()
}

test('viés de direção puxa o carrinho e a integridade bloqueia', async ({ browser }) => {
  test.setTimeout(60_000)
  const { viewer, attacker, defender, pilot } = await scene(browser)
  await choose(attacker, 'Viés de direção', '40% direita')
  await expect(attacker.getByText('Ataque ativo em Carrinho B')).toBeVisible()
  await holdJoystick(pilot, 0, -1)
  const panel = carPanel(viewer, 'Carrinho B')
  await expect(panel.getByRole('img', { name: 'Confirmado: frente, direção 40% à direita' })).toBeVisible()
  await pilot.mouse.up()
  await defender.getByRole('switch', { name: /Desligada|Bloqueando/ }).first().click()
  await expect(defender.getByText('Bloqueando alterações')).toBeVisible()
  await holdJoystick(pilot, 0, -1)
  await expect(panel.getByRole('img', { name: 'Confirmado: frente, direção centro' })).toBeVisible()
  await pilot.mouse.up()
})

test('interceptação mostra o tráfego e a criptografia embaralha', async ({ browser }) => {
  test.setTimeout(60_000)
  const { attacker, defender, pilot } = await scene(browser, ['Interceptar tráfego'])
  await holdJoystick(pilot, 0, -1)
  const feed = attacker.getByRole('list', { name: 'Tráfego interceptado' })
  await expect(feed.getByText(/pilot\.drive/).first()).toBeVisible()
  await pilot.mouse.up()
  await defender.getByRole('switch', { name: 'Desligada' }).last().click()
  await expect(defender.getByText('Tráfego cifrado')).toBeVisible()
  await expect(defender.getByRole('img', { name: '1 de 4 camadas demonstradas' })).toBeVisible()
  await holdJoystick(pilot, 0, -1)
  await expect(attacker.getByText('Tráfego cifrado pelo defensor: ilegível')).toBeVisible()
  await pilot.mouse.up()
})

test('quebra de senha encontra a senha padrão', async ({ browser }) => {
  const { attacker } = await scene(browser)
  await attacker.getByRole('button', { name: 'Ataque de dicionário' }).click()
  await expect(attacker.getByText(/senha encontrada na tentativa \d+ de \d+: 1234/)).toBeVisible()
})

test('derrubar o link para o carrinho e volta sozinho', async ({ browser }) => {
  test.setTimeout(60_000)
  const { viewer, attacker, pilot } = await scene(browser)
  await holdJoystick(pilot, 0, -1)
  const panel = carPanel(viewer, 'Carrinho B')
  await expect(panel.getByRole('img', { name: 'Confirmado: frente, direção centro' })).toBeVisible()
  await attacker.getByRole('button', { name: 'Derrubar por 5 s' }).click()
  await expect(attacker.getByRole('status').filter({ hasText: 'Link derrubado' })).toBeVisible()
  await expect(panel.getByText('LINK DERRUBADO', { exact: true })).toBeVisible()
  await expect(panel.getByRole('img', { name: 'Confirmado: parado, direção centro' })).toBeVisible()
  await expect(panel.getByText('LINK DERRUBADO', { exact: true })).toHaveCount(0, { timeout: 10_000 })
  await expect(attacker.getByRole('button', { name: 'Derrubar por 5 s' })).toBeDisabled()
  await pilot.mouse.up()
})

test('telemetria falsa engana o monitor do defensor, não o projetor', async ({ browser }) => {
  test.setTimeout(60_000)
  const { viewer, defender, pilot } = await scene(browser, ['Frente ↔ Ré', 'Falsificar telemetria'])
  await holdJoystick(pilot, 0, -1)
  await expect(carPanel(viewer, 'Carrinho B').getByText('COMANDO ALTERADO NO CAMINHO')).toBeVisible()
  const monitor = defender.getByRole('region', { name: 'Monitor do seu carrinho' })
  await expect(monitor.getByRole('img', { name: 'Confirmado: frente, direção centro' })).toBeVisible()
  await expect(monitor.getByText('COMANDO ALTERADO NO CAMINHO')).toHaveCount(0)
  await pilot.mouse.up()
})

test('sequestro tira o controle do piloto e o hacker dirige', async ({ browser }) => {
  test.setTimeout(60_000)
  const { viewer, attacker, pilot } = await scene(browser)
  await attacker.getByRole('switch', { name: 'Sequestrar o carrinho' }).click()
  await expect(pilot.getByRole('status').filter({ hasText: 'Controle tomado pelo invasor' })).toBeVisible()
  const panel = carPanel(viewer, 'Carrinho B')
  await expect(panel.getByText('CARRINHO SEQUESTRADO', { exact: true })).toBeVisible()
  await holdJoystick(attacker, 0, -1, /Analógico do sequestro/)
  await expect(panel.getByRole('img', { name: 'Confirmado: frente, direção centro' })).toBeVisible()
  await attacker.mouse.up()
  await expect(panel.getByRole('img', { name: 'Confirmado: parado, direção centro' })).toBeVisible()
  await attacker.getByRole('switch', { name: 'Sequestrar o carrinho' }).click()
  await expect(pilot.getByRole('status').filter({ hasText: 'Em demonstração' })).toBeVisible()
})
