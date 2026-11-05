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

export async function resetEnvironment(browser: Browser, demoState?: 'running') {
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
