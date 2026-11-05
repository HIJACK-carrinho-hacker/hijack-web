import { expect, test } from '@playwright/test'

test('simulador mostra os dois carrinhos e o rótulo de simulação', async ({ page }) => {
  await page.goto('/simulator')
  await expect(page.getByText('SIMULAÇÃO')).toBeVisible()
  await expect(page.getByText('Conectado')).toBeVisible()
  await expect(page.getByText(/^Carrinho A/)).toBeVisible()
  await expect(page.getByText(/^Carrinho B/)).toBeVisible()
})

test('segurar o botão de teste move só o carrinho escolhido e soltar para', async ({ page }) => {
  await page.goto('/simulator')
  await expect(page.getByText('Conectado')).toBeVisible()
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
