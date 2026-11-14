import { expect, test } from '@playwright/test'
import { adminSend, holdJoystick, loginAs, operatorPage, resetEnvironment } from './helpers.ts'

test.describe.configure({ mode: 'serial' })

test.afterAll(async ({ browser }) => {
  await resetEnvironment(browser, 'dual')
})

test('vaga liberada pelo operador leva o piloto à entrada, sem joystick', async ({ browser }) => {
  await resetEnvironment(browser, 'dual', 'running')
  const pilotCtx = await browser.newContext()
  const pilot = await pilotCtx.newPage()
  await loginAs(pilot, { name: 'Ana', role: 'Piloto', car: 'Carrinho A' })
  await expect(pilot.getByRole('status').filter({ hasText: 'Em demonstração' })).toBeVisible()
  await expect(pilot.getByRole('application', { name: /Analógico/ })).toBeVisible()

  const operator = await operatorPage(browser)
  await adminSend(operator.page, [{ type: 'admin.releaseSlot', payload: { carId: 'car-a', role: 'pilot' } }])
  await operator.close()

  await expect(pilot).toHaveURL('/')
  await expect(pilot.getByText(/vaga liberada pelo operador/i)).toBeVisible()
  await expect(pilot.getByRole('application', { name: /Analógico/ })).toHaveCount(0)
  await pilotCtx.close()
})

test('depois de pausar e retomar, o toque recusado avisa para soltar o joystick', async ({ browser }) => {
  await resetEnvironment(browser, 'dual', 'running')
  const pilotCtx = await browser.newContext()
  const pilot = await pilotCtx.newPage()
  await loginAs(pilot, { name: 'Ana', role: 'Piloto', car: 'Carrinho A' })
  await expect(pilot.getByRole('status').filter({ hasText: 'Em demonstração' })).toBeVisible()

  const operator = await operatorPage(browser)
  await adminSend(operator.page, [{ type: 'admin.setDemoState', payload: { state: 'paused' } }])
  await expect(pilot.getByRole('status').filter({ hasText: 'Pausado' })).toBeVisible()

  const host = new URL(pilot.url()).host
  await pilot.evaluate(async (host) => {
    const ws = new WebSocket(`ws://${host}/ws`)
    await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))
    ws.send(
      JSON.stringify({
        protocolVersion: 1,
        type: 'pilot.drive',
        requestId: crypto.randomUUID(),
        sentAt: Date.now(),
        payload: { throttle: 1, steering: 0, pressed: true },
      }),
    )
    await new Promise((resolve) => setTimeout(resolve, 300))
    ws.close()
  }, host)

  await adminSend(operator.page, [{ type: 'admin.setDemoState', payload: { state: 'running' } }])
  await operator.close()
  await expect(pilot.getByRole('status').filter({ hasText: 'Em demonstração' })).toBeVisible()

  await holdJoystick(pilot, 0, -1)
  await expect(pilot.getByText('Solte o joystick e toque de novo para voltar a mover.')).toBeVisible()
  await pilot.mouse.up()
  await pilotCtx.close()
})

test('erro do servidor aparece no cartão de defesa e o interruptor é liberado', async ({ browser }) => {
  await resetEnvironment(browser, 'dual', 'running')
  const defenderCtx = await browser.newContext()
  const defender = await defenderCtx.newPage()
  await defender.routeWebSocket(/\/ws$/, (ws) => {
    const server = ws.connectToServer()
    server.onMessage((message) => ws.send(message))
    ws.onMessage((message) => {
      const text = typeof message === 'string' ? message : message.toString()
      let parsed: { type?: string; requestId?: string } = {}
      try {
        parsed = JSON.parse(text)
      } catch {}
      if (parsed.type === 'defense.setIntegrityDemo' || parsed.type === 'defense.setReplayDemo') {
        ws.send(
          JSON.stringify({
            protocolVersion: 1,
            type: 'system.error',
            eventId: 0,
            serverTime: Date.now(),
            stateRevision: 0,
            requestId: parsed.requestId,
            payload: { code: 'forbidden', message: 'defesa recusada pelo servidor de teste' },
          }),
        )
        return
      }
      server.send(message)
    })
  })
  await loginAs(defender, { name: 'Caio', role: 'Hacker', car: 'Carrinho B' })
  await defender.getByRole('tab', { name: 'Defesa' }).click()

  const integrity = defender.getByRole('switch', { name: 'Desligada' }).first()
  await integrity.click()
  await expect(defender.getByRole('alert').filter({ hasText: 'defesa recusada pelo servidor de teste' })).toHaveCount(1)
  await expect(integrity).toBeEnabled()
  await expect(integrity).toHaveAttribute('aria-checked', 'false')
  await expect(defender.getByText('Bloqueando alterações')).toHaveCount(0)

  await defender.locator('#replay').click()
  await expect(defender.getByRole('alert').filter({ hasText: 'defesa recusada pelo servidor de teste' })).toHaveCount(2)
  await expect(defender.locator('#replay')).toBeEnabled()
  await expect(defender.locator('#replay')).toHaveAttribute('aria-checked', 'false')
  await expect(defender.getByText('Recusando comandos antigos')).toHaveCount(0)
  await defenderCtx.close()
})
