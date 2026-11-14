import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { Browser, Page } from '@playwright/test'

export function adminSecret(): string {
  try {
    const env = readFileSync(path.resolve(import.meta.dirname, '../../../server/.env'), 'utf8')
    const line = env.split('\n').find((l) => l.startsWith('ADMIN_SECRET='))
    if (line) return line.slice('ADMIN_SECRET='.length).trim()
  } catch {}
  return 'e2e-admin-secret'
}

export async function adminSend(page: Page, messages: { type: string; payload: unknown }[]) {
  const host = new URL(page.url()).host
  await page.evaluate(async ({ msgs, host }) => {
    const ws = new WebSocket(`ws://${host}/ws`)
    await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))
    for (const m of msgs) {
      ws.send(JSON.stringify({ protocolVersion: 1, type: m.type, requestId: crypto.randomUUID(), sentAt: Date.now(), payload: m.payload }))
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
    ws.close()
  }, { msgs: messages, host })
}

export type Topology = 'single' | 'dual'

export async function resetEnvironment(browser: Browser, topology: Topology, demoState?: 'running') {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/admin')
  const res = await page.request.post('/api/admin/session', { data: { secret: adminSecret() } })
  if (!res.ok()) throw new Error(`login do operador falhou: ${res.status()}`)
  const msgs: { type: string; payload: unknown }[] = []
  for (const carId of ['car-a', 'car-b']) {
    for (const role of ['pilot', 'hacker']) msgs.push({ type: 'admin.releaseSlot', payload: { carId, role } })
  }
  msgs.push({ type: 'admin.setDemoState', payload: { state: 'paused' } })
  msgs.push({ type: 'admin.setDemoState', payload: { state: 'stopped' } })
  msgs.push({ type: 'admin.setDemoState', payload: { state: 'setup' } })
  msgs.push({ type: 'admin.setTopology', payload: { topology } })
  msgs.push({ type: 'admin.resetDemo', payload: { resetAttacks: true, resetDefenses: true, resetPasswords: true } })
  if (demoState === 'running') {
    msgs.push({ type: 'admin.setDemoState', payload: { state: 'ready' } })
    msgs.push({ type: 'admin.setDemoState', payload: { state: 'running' } })
  }
  await adminSend(page, msgs)
  await ctx.close()
}

export async function loginAs(page: Page, opts: { name: string; role: 'Piloto' | 'Hacker'; car: 'Carrinho A' | 'Carrinho B'; password?: string }) {
  await page.goto('/')
  await page.getByLabel('Seu nome').fill(opts.name)
  await page.getByRole('radio', { name: new RegExp(opts.role) }).click()
  if (opts.car === 'Carrinho B') {
    await page.getByLabel('Seu carrinho').click()
    await page.getByRole('option', { name: 'Carrinho B' }).click()
  }
  await page.getByLabel('Senha do carrinho').fill(opts.password ?? '1234')
  await page.getByRole('button', { name: 'Conectar e entrar' }).click()
}

export async function loginSingle(page: Page, opts: { name: string; slot: 'pilot' | 'hackerA' | 'hackerB'; password?: string }) {
  await page.goto('/')
  await page.getByLabel('Seu nome').fill(opts.name)
  await page.getByRole('radio', { name: new RegExp(opts.slot === 'pilot' ? 'Piloto' : 'Hacker') }).click()
  if (opts.slot === 'hackerB') {
    await page.getByLabel('Sua equipe').click()
    await page.getByRole('option', { name: /^Equipe B — ataca/ }).click()
  }
  await page.getByLabel(opts.slot === 'hackerB' ? 'Senha da equipe B' : 'Senha do carrinho').fill(opts.password ?? '1234')
  await page.getByRole('button', { name: 'Conectar e entrar' }).click()
}

export const carPanel = (page: Page, name: 'Carrinho A' | 'Carrinho B') =>
  page.locator('[data-slot=card]').filter({ hasText: new RegExp(`^${name}`) })

export async function holdJoystick(page: Page, dx: number, dy: number) {
  const joy = page.getByRole('application', { name: /Analógico/ })
  await joy.scrollIntoViewIfNeeded()
  const box = await joy.boundingBox()
  if (!box) throw new Error('joystick sem posição')
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + dx * box.width * 0.3, cy + dy * box.height * 0.3, { steps: 4 })
}

export async function completeAttack(hacker: Page, target: 'Carrinho A' | 'Carrinho B', switches: ('Frente ↔ Ré' | 'Esquerda ↔ Direita')[]) {
  await hacker.getByRole('button', { name: 'Escanear rede' }).click()
  await hacker.getByRole('button', { name: new RegExp(target) }).click()
  await hacker.getByRole('button', { name: 'Explorar vulnerabilidade' }).click()
  await hacker.getByText(/Relatório simulado/).waitFor()
  for (const s of switches) {
    await hacker.getByRole('switch', { name: s }).click()
    await hacker.getByRole('switch', { name: s, checked: true }).waitFor()
  }
}

export async function operatorPage(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/admin')
  const res = await page.request.post('/api/admin/session', { data: { secret: adminSecret() } })
  if (!res.ok()) throw new Error(`login do operador falhou: ${res.status()}`)
  return { page, close: () => ctx.close() }
}
