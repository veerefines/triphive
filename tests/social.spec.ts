/**
 * TripHive social loop, two real users:
 *   1. A creates a Lisbon trip and makes it Public.
 *   2. B saves a profile and plans their own Lisbon trip on nearby dates.
 *   3. B cannot open A's trip by URL (still RBAC 'team'), but sees it on
 *      Discover under "Travelers near your dates" (±5-day match).
 *   4. B asks to join with a pitch → B's chat is locked.
 *   5. A sees the request in Inbox (badge), accepts → chat unlocks both ways.
 *   6. B now opens the trip, suggests a TripHive Featured place → it lands
 *      in A's Votes; group chat works both ways.
 */
import { test, expect, loadAllTestAccounts } from 'deepspace/testing'
import type { Page } from '@playwright/test'

test.skip(loadAllTestAccounts().length < 2, 'Needs 2 test accounts')
test.setTimeout(180_000)

async function createTrip(page: Page, title: string, start: string, end: string) {
  await page.goto('/trips')
  await page.getByLabel('Name').fill(title)
  await page.getByLabel('Destination city').fill('Lisbon')
  await page.getByLabel('From', { exact: true }).fill(start)
  await page.getByLabel('To', { exact: true }).fill(end)
  await page.getByRole('button', { name: 'Create trip' }).click()
  await page.waitForURL(/\/trips\/trip_/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible({ timeout: 30_000 })
  return page.url()
}

const day = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

test('public trip → request → accept → chat → suggest', async ({ users }) => {
  const [a, b] = await users(2)
  const stamp = Date.now().toString(36)
  const title = `Public ${stamp}`
  const bTitle = `Solo ${stamp}`

  // 1. A creates + publishes.
  const tripUrl = await createTrip(a.page, title, day(10), day(13))
  await a.page.getByTestId('visibility').click()
  const dlg = a.page.getByRole('dialog')
  await dlg.getByRole('button', { name: /Public/ }).click()
  await dlg.getByLabel('Pitch your trip').fill('Food markets and sunsets, looking for one more!')
  await dlg.getByRole('button', { name: /Foodie/ }).click()
  await dlg.getByRole('button', { name: 'Publish' }).click()
  await expect(a.page.getByTestId('visibility')).toHaveText(/Public/, { timeout: 20_000 })

  // 2. B profile + own overlapping trip (3 days after A's ends → within ±5).
  await b.page.goto('/profile')
  await b.page.getByLabel('Home city').fill('Mumbai')
  await b.page.getByRole('button', { name: 'Street food' }).click()
  await b.page.getByRole('button', { name: 'Save profile' }).click()
  await expect(b.page.getByText('Profile saved')).toBeVisible({ timeout: 15_000 })
  await createTrip(b.page, bTitle, day(15), day(17))

  // 3. No access by URL; visible on Discover as a match.
  await b.page.goto(tripUrl)
  await expect(b.page.getByText('Trip not found')).toBeVisible({ timeout: 20_000 })
  await b.page.goto('/discover')
  await expect(b.page.getByText('Travelers near your dates')).toBeVisible({ timeout: 20_000 })
  const card = b.page.getByTestId('public-trip').filter({ hasText: title }).first()
  await expect(card).toContainText('days apart')
  await card.getByRole('link', { name: 'Ask to join' }).click()

  // 4. Pitch → locked chat.
  await b.page.getByLabel('Your pitch').fill('Hi! I am in Lisbon right after you — would love to join for the food markets.')
  await b.page.getByRole('button', { name: 'Send request' }).click()
  await b.page.waitForURL(/\/inbox/)
  await b.page.getByTestId('thread').filter({ hasText: title }).click()
  await expect(b.page.getByTestId('chat-locked')).toBeVisible({ timeout: 15_000 })

  // 5. A accepts from the inbox.
  await a.page.goto('/inbox')
  await expect(a.page.getByTestId('inbox-badge')).toBeVisible({ timeout: 20_000 })
  await a.page.getByTestId('thread').filter({ hasText: title }).click()
  await expect(a.page.getByTestId('dm').filter({ hasText: 'food markets' })).toBeVisible({ timeout: 15_000 })
  await a.page.getByTestId('request-bar').getByRole('button', { name: 'Accept' }).click()
  await expect(a.page.getByText('chat is unlocked')).toBeVisible({ timeout: 20_000 })

  await expect(b.page.getByTestId('chat-locked')).toBeHidden({ timeout: 20_000 })
  await b.page.getByLabel('Message').fill('See you in Lisbon!')
  await b.page.getByRole('button', { name: 'Send' }).click()
  await expect(a.page.getByTestId('dm').filter({ hasText: 'See you in Lisbon!' })).toBeVisible({ timeout: 20_000 })

  // 6. B is now a member: open trip, suggest a Featured place, group chat.
  await b.page.goto(tripUrl)
  await expect(b.page.getByRole('heading', { level: 1, name: title })).toBeVisible({ timeout: 30_000 })
  await b.page.getByRole('button', { name: /^Explore/ }).click()
  await b.page.getByTestId('featured-place').filter({ hasText: 'Time Out Market' }).getByRole('button', { name: 'Suggest to group' }).click()
  await expect(b.page.getByText('Suggested to the group')).toBeVisible({ timeout: 20_000 })
  await b.page.getByRole('button', { name: /^Chat/ }).click()
  await b.page.getByLabel('Message the group').fill('Hello group 👋')
  await b.page.getByRole('button', { name: 'Send' }).click()

  await a.page.goto(tripUrl)
  await a.page.getByRole('button', { name: /^Votes/ }).click()
  await expect(a.page.getByText(/Add Time Out Market Lisboa/)).toBeVisible({ timeout: 20_000 })
  await a.page.getByRole('button', { name: /^Chat/ }).click()
  await expect(a.page.getByTestId('group-msg').filter({ hasText: 'Hello group' })).toBeVisible({ timeout: 20_000 })

  // 7. Trip cost: per-person estimate in EUR with a cash suggestion.
  await a.page.getByRole('button', { name: /^Cost/ }).click()
  const budget = a.page.getByTestId('trip-budget')
  await expect(budget).toContainText('€')
  await expect(budget).toContainText(/Carry about/)

  // Cleanup.
  await a.page.goto('/trips')
  await a.page.getByRole('button', { name: `Delete ${title}` }).click()
  await a.page.getByRole('dialog').getByRole('button', { name: 'Delete trip' }).click()
  await b.page.goto('/trips')
  await b.page.getByRole('button', { name: `Delete ${bTitle}` }).click()
  await b.page.getByRole('dialog').getByRole('button', { name: 'Delete trip' }).click()
  await expect(b.page.getByRole('heading', { name: bTitle })).toHaveCount(0, { timeout: 20_000 })
})
