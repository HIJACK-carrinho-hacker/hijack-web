import AxeBuilder from '@axe-core/playwright'
import { type Page, expect, test } from '@playwright/test'
import { adminSecret, loginAs, resetEnvironment } from './helpers.ts'

test.describe.configure({ mode: 'serial' })

test.afterAll(async ({ browser }) => {
  await resetEnvironment(browser)
})

async function audit(page: Page, name: string) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  const serious = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const summary = serious.map((v) => `${name}: ${v.id} (${v.impact}) — ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)
  expect(summary).toEqual([])
}

test('telas sem violações sérias de acessibilidade', async ({ browser, page }) => {
  test.setTimeout(60_000)
  await resetEnvironment(browser, 'running')
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Conectar e entrar' })).toBeVisible()
  await audit(page, 'entrada')

  await loginAs(page, { name: 'Ana', role: 'Piloto', car: 'Carrinho A' })
  await expect(page.getByRole('status').filter({ hasText: 'Em demonstração' })).toBeVisible()
  await audit(page, 'piloto')

  const hacker = await (await browser.newContext()).newPage()
  await loginAs(hacker, { name: 'Bruno', role: 'Hacker', car: 'Carrinho B' })
  await expect(hacker.getByRole('button', { name: 'Escanear rede' })).toBeVisible()
  await audit(hacker, 'hacker-ataque')
  await hacker.getByRole('tab', { name: 'Defesa' }).click()
  await expect(hacker.getByText('Simulação, não HMAC')).toBeVisible()
  await audit(hacker, 'hacker-defesa')

  const viewer = await (await browser.newContext()).newPage()
  await viewer.goto('/simulator')
  await expect(viewer.getByText('SIMULAÇÃO')).toBeVisible()
  await audit(viewer, 'simulador')

  const admin = await (await browser.newContext()).newPage()
  await admin.goto('/admin')
  await audit(admin, 'admin-login')
  await admin.request.post('/api/admin/session', { data: { secret: adminSecret() } })
  await admin.reload()
  await expect(admin.getByText('Acesso pela rede')).toBeVisible()
  await audit(admin, 'admin')
})
