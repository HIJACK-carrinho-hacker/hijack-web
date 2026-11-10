import { expect, test } from '@playwright/test'
import { adminSecret, resetEnvironment } from './helpers.ts'

test.describe.configure({ mode: 'serial' })

test.beforeEach(async ({ browser }) => {
  await resetEnvironment(browser, 'dual')
})

test('simulador público mostra os dois carrinhos sem controles de operador', async ({ page }) => {
  await page.goto('/simulator')
  await expect(page.getByText('SIMULAÇÃO')).toBeVisible()
  await expect(page.getByText('Conectado')).toBeVisible()
  await expect(page.getByText(/^Carrinho A/)).toBeVisible()
  await expect(page.getByText(/^Carrinho B/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'STOP ALL' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Teste: ↑' })).toHaveCount(0)
})

test('operador segura o botão de teste: move só o carrinho escolhido e soltar para', async ({ page }) => {
  await page.goto('/simulator')
  await page.request.post('/api/admin/session', { data: { secret: adminSecret() } })
  await page.reload()
  const pad = page.getByRole('button', { name: 'Teste: ↑' }).first()
  await pad.scrollIntoViewIfNeeded()
  const box = await pad.boundingBox()
  if (!box) throw new Error('botão sem posição')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(page.getByText('em movimento')).toHaveCount(1)
  await page.mouse.up()
  await expect(page.getByText('em movimento')).toHaveCount(0)
})
