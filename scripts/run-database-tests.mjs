import { readdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { databaseTestInput, databaseTestPassed } from './database-test-tap.mjs'

// Deliberately limited to a disposable local database. Never run against customer data.
const connection = process.env.DATABASE_TEST_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
const url = new URL(connection)
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error('Database tests require a disposable local PostgreSQL instance.')
const directory = fileURLToPath(new URL('../supabase/tests/', import.meta.url))
let failed = false
for (const file of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
  const source = readFileSync(`${directory}/${file}`, 'utf8')
  const input = databaseTestInput(source)
  const result = spawnSync('psql', [connection, '-X', '-v', 'ON_ERROR_STOP=1', '-At'], { input, encoding: 'utf8' })
  if (result.error) { console.error(result.error.message); process.exit(1) }
  const success = databaseTestPassed(result)
  console.log(`${success ? 'PASS' : 'FAIL'} ${file}`)
  if (!success) { failed = true; console.error(result.stderr || ''); console.error(result.stdout || '') }
}
process.exitCode = failed ? 1 : 0
