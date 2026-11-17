import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { adminSend, completeAttack, loginAs, operatorPage, resetEnvironment } from './helpers.ts'

test.describe.configure({ mode: 'serial' })

test.afterAll(async ({ browser }) => {
  await resetEnvironment(browser, 'dual')
})

test('explicações dos 12 ataques e das 4 defesas abrem sem executar ações', async ({ browser, page, isMobile }) => {
  test.setTimeout(60_000)
  await resetEnvironment(browser, 'dual', 'running')
  const actions: string[] = []
  page.on('websocket', (socket) => socket.on('framesent', ({ payload }) => {
    const message = JSON.parse(String(payload)) as { type: string }
    if (/^(attack\.|defense\.|auth\.changePassword)/.test(message.type)) actions.push(message.type)
  }))
  await loginAs(page, { name: 'Ana', role: 'Hacker', car: 'Carrinho A' })
  await completeAttack(page, 'Carrinho B', [])
  const operator = await operatorPage(browser)
  await adminSend(operator.page, [{ type: 'admin.setDemoState', payload: { state: 'paused' } }])
  await operator.close()
  await expect(page.getByRole('switch', { name: 'Frente ↔ Ré', exact: true })).toBeDisabled()
  actions.length = 0

  const attacks = [
    'Frente ↔ Ré', 'Esquerda ↔ Direita', 'Viés de direção', 'Travar direção',
    'Replay (repete 5 s atrás)', 'Atraso', 'Perda de pacotes', 'Interceptar tráfego',
    'Quebrar senha', 'Derrubar o link', 'Falsificar telemetria', 'Sequestrar o carrinho',
  ]
  for (const label of attacks) {
    const trigger = page.getByRole('button', { name: `Saiba mais: ${label}`, exact: true })
    if (isMobile) await trigger.tap()
    else await trigger.click()
    const explanation = page.getByRole('dialog', { name: label, exact: true })
    await expect(explanation).toBeVisible()
    await expect(explanation.getByText('Na vida real', { exact: true })).toBeVisible()
    await expect(explanation.getByText('No HIJACK', { exact: true })).toBeVisible()
    const box = await explanation.boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
    await explanation.getByRole('button', { name: 'Fechar explicação' }).click()
    await expect(explanation).toBeHidden()
  }

  await page.getByRole('tab', { name: 'Defesa' }).click()
  for (const label of ['Autenticação', 'Integridade', 'Repetição', 'Criptografia']) {
    await page.getByRole('button', { name: `Saiba mais: ${label}`, exact: true }).click()
    const explanation = page.getByRole('dialog', { name: label, exact: true })
    await expect(explanation.getByText('Na vida real', { exact: true })).toBeVisible()
    await expect(explanation.getByText('No HIJACK', { exact: true })).toBeVisible()
    if (label === 'Criptografia') {
      await expect(explanation.getByText(/a rede continua em texto claro/)).toBeVisible()
      const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(audit.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
    }
    await explanation.getByRole('button', { name: 'Fechar explicação' }).click()
  }
  expect(actions).toEqual([])
})

test('ajuda abre por teclado e mouse, preserva foco e fecha com Escape ou fora', async ({ browser, page, isMobile }) => {
  await resetEnvironment(browser, 'dual')
  await loginAs(page, { name: 'Ana', role: 'Hacker', car: 'Carrinho A' })
  await page.getByRole('tab', { name: 'Defesa' }).click()
  const trigger = page.getByRole('button', { name: 'Saiba mais: Integridade', exact: true })
  const explanation = page.getByRole('dialog', { name: 'Integridade', exact: true })
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(explanation).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(explanation).toBeHidden()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Space')
  await explanation.getByRole('button', { name: 'Fechar explicação' }).click()
  await expect(explanation).toBeHidden()
  await expect(trigger).toBeFocused()

  if (!isMobile) {
    const password = page.getByLabel('Senha atual', { exact: true })
    await password.focus()
    await trigger.hover()
    await expect(explanation).toBeVisible()
    await expect(password).toBeFocused()
    await explanation.getByText('Na vida real', { exact: true }).hover()
    await expect(explanation).toBeVisible()
    await page.mouse.move(0, 0)
    await expect(explanation).toBeHidden()
    await expect(password).toBeFocused()
    await trigger.hover()
    await trigger.click()
    await page.mouse.move(0, 0)
    await expect(explanation).toBeVisible()
    await page.getByText('Troca real da senha do carrinho.', { exact: false }).click()
    await expect(explanation).toBeHidden()
  }
})
