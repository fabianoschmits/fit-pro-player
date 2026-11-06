import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createLifecycleBrowserDatabase } from './lifecycle-browser-database.mjs'

test('invite history resolves direct and requested acceptance, enforces ownership and preserves student records', async () => {
  const fixture = await createLifecycleBrowserDatabase()
  try {
    await fixture.db.exec(readFileSync(new URL('../supabase/tests/202611050001_professional_invite_history.sql', import.meta.url), 'utf8').replace(/^\uFEFF/, ''))
  } finally { await fixture.close() }
})
