#!/usr/bin/env node
// Publishes the exact license and NOTICE files shipped by the animation dependencies.
// Keeping this generated artifact in public/ makes the notices available in every web build.

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const packages = [
  ['posecode-parser 0.4.2', 'posecode-parser'],
  ['posecode-render 0.4.2', 'posecode-render'],
  ['three 0.185.1', 'three'],
]

const sections = []
for (const [label, packageName] of packages) {
  const base = join(here, '..', 'node_modules', packageName)
  const license = await readFile(join(base, 'LICENSE'), 'utf8')
  let notice = ''
  try { notice = await readFile(join(base, 'NOTICE'), 'utf8') } catch { /* optional */ }
  sections.push(`${'='.repeat(78)}\n${label}\n${'='.repeat(78)}\n${notice}${notice ? '\n' : ''}${license.trim()}\n`)
}

const output = join(here, '..', 'public', 'third-party-licenses.txt')
await writeFile(output, `Fit Pro Player — third-party animation licenses\n\n${sections.join('\n')}`, 'utf8')
console.log(`Generated third-party license bundle at ${output}`)
