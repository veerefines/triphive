/**
 * TripHive core path, two real users in separate browser contexts:
 *   1. A creates a trip.
 *   2. B (not a member) opens the trip URL and sees nothing — RBAC 'team'.
 *   3. B joins with the invite code.
 *   4. A adds a stop; it appears live for B.
 *   5. A adds an overlapping stop; Plan Doctor's issue appears for B.
 *   6. B leaves via the trips list. 7. A deletes via the trips list.
 * Hive (LLM) is verified manually — it is non-deterministic and billed.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 2, 'Needs 2 test accounts (npx deepspace test accounts create …)')
test.setTimeout(120_000)

async function addStop(page: Page, title: string, start: string, end: string) {
  await page.getByRole('button', { name: 'Add stop' }).first().click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Place or activity').fill(title)
  await dialog.getByLabel('Start').fill(start)
  await dialog.getByLabel('End').fill(end)
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()
}

test('two travelers plan one trip together', async ({ users }) => {
  const [a, b] = await users(2)
  const title = `E2E ${Date.now().toString(36)}`

  // 1. A creates a trip.
  await a.page.goto('/trips')
  await a.page.getByLabel('Name').fill(title)
  await a.page.getByLabel('Destination city').fill('Lisbon')
  await a.page.getByRole('button', { name: 'Create trip' }).click()
  await expect(a.page).toHaveURL(/\/trips\/trip_/, { timeout: 30_000 })
  await expect(a.page.getByRole('heading', { level: 1, name: title })).toBeVisible({ timeout: 30_000 })
  const tripUrl = a.page.url()
  const code = (await a.page.getByTestId('invite-code').innerText()).replace(/[^A-Z0-9]/g, '')
  expect(code).toMatch(/^[A-Z0-9]{6}$/)

  // 2. B is not a member yet: the trip must not be readable.
  await b.page.goto(tripUrl)
  await expect(b.page.getByText('Trip not found')).toBeVisible({ timeout: 20_000 })

  // 3. B joins with the code.
  await b.page.goto('/trips')
  await b.page.getByLabel('Invite code').fill(code)
  await b.page.getByRole('button', { name: 'Join trip' }).click()
  await expect(b.page).toHaveURL(tripUrl, { timeout: 30_000 })
  await expect(b.page.getByRole('heading', { level: 1, name: title })).toBeVisible({ timeout: 30_000 })

  // 4. A adds a stop → B sees it without reloading.
  await addStop(a.page, 'Castelo de São Jorge', '10:00', '11:30')
  await expect(b.page.getByTestId('stop-card').filter({ hasText: 'Castelo de São Jorge' })).toBeVisible({ timeout: 20_000 })

  // 5. Overlap → Plan Doctor issue visible to B.
  await addStop(a.page, 'Time Out Market', '11:00', '12:00')
  await expect(b.page.getByTestId('stop-card').filter({ hasText: 'Time Out Market' })).toBeVisible({ timeout: 20_000 })
  await b.page.getByRole('button', { name: /^Issues/ }).click()
  await expect(b.page.getByTestId('issue').filter({ hasText: 'overlaps' })).toBeVisible({ timeout: 20_000 })

  // 6. B leaves from the trips list; the card disappears for B only.
  await b.page.goto('/trips')
  await b.page.getByRole('button', { name: `Leave ${title}` }).click()
  await b.page.getByRole('dialog').getByRole('button', { name: 'Leave trip' }).click()
  await expect(b.page.getByRole('heading', { name: title })).toHaveCount(0, { timeout: 20_000 })

  // 7. A (organizer) deletes from the trips list; the trip is gone.
  await a.page.goto('/trips')
  await a.page.getByRole('button', { name: `Delete ${title}` }).click()
  await a.page.getByRole('dialog').getByRole('button', { name: 'Delete trip' }).click()
  await expect(a.page.getByRole('heading', { name: title })).toHaveCount(0, { timeout: 20_000 })
  await a.page.goto(tripUrl)
  await expect(a.page.getByText('Trip not found')).toBeVisible({ timeout: 20_000 })
})
