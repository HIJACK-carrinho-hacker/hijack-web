import { expect, test } from '@playwright/test'
import { carPanel, holdJoystick, loginAs, resetEnvironment } from './helpers.ts'

test.describe.configure({ mode: 'serial' })

test.afterAll(async ({ browser }) => {
  await resetEnvironment(browser, 'dual')
})

test('antes da largada o piloto aguarda e os botões A/B não têm função', async ({ browser, page }) => {
  await resetEnvironment(browser, 'dual')
  await loginAs(page, { name: 'Ana', role: 'Piloto', car: 'Carrinho A' })
  await expect(page).toHaveURL('/pilot')
  await expect(page.getByRole('status').filter({ hasText: 'Aguardando a largada' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Botão A/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: /Botão B/ })).toBeDisabled()
})

test('analógico move só o carrinho do piloto e soltar para', async ({ browser, page }) => {
  await resetEnvironment(browser, 'dual', 'running')
  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto('/simulator')
  await loginAs(page, { name: 'Ana', role: 'Piloto', car: 'Carrinho A' })
  await expect(page.getByRole('status').filter({ hasText: 'Em demonstração' })).toBeVisible()

  await holdJoystick(page, 1, -1)
  await expect(carPanel(viewer, 'Carrinho A').getByText('em movimento')).toBeVisible()
  await page.waitForTimeout(800)
  await expect(carPanel(viewer, 'Carrinho A').getByText('em movimento')).toBeVisible()
  await expect(carPanel(viewer, 'Carrinho B').getByText('em movimento')).toHaveCount(0)

  await page.mouse.up()
  await expect(carPanel(viewer, 'Carrinho A').getByText('em movimento')).toHaveCount(0)
  await expect(carPanel(viewer, 'Carrinho A').getByText('Piloto parou')).toBeVisible()
})

test('teclado WASD dirige no computador', async ({ browser, page }, info) => {
  test.skip(info.project.name === 'mobile', 'teclado só no desktop')
  await resetEnvironment(browser, 'dual', 'running')
  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto('/simulator')
  await loginAs(page, { name: 'Bia', role: 'Piloto', car: 'Carrinho B' })
  await expect(page.getByRole('status').filter({ hasText: 'Em demonstração' })).toBeVisible()
  await page.keyboard.down('w')
  await expect(carPanel(viewer, 'Carrinho B').getByText('em movimento')).toBeVisible()
  await page.keyboard.up('w')
  await expect(carPanel(viewer, 'Carrinho B').getByText('em movimento')).toHaveCount(0)
})

test('fechar a página do piloto para o carrinho', async ({ browser }) => {
  await resetEnvironment(browser, 'dual', 'running')
  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto('/simulator')
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await loginAs(page, { name: 'Ana', role: 'Piloto', car: 'Carrinho A' })
  await expect(page.getByRole('status').filter({ hasText: 'Em demonstração' })).toBeVisible()
  await holdJoystick(page, 0, -1)
  await expect(carPanel(viewer, 'Carrinho A').getByText('em movimento')).toBeVisible()
  await ctx.close()
  await expect(carPanel(viewer, 'Carrinho A').getByText('em movimento')).toHaveCount(0)
})
