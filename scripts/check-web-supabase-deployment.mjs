import { execSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = file => readFileSync(join(root, file), 'utf8')
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const dockerfile = read('web/Dockerfile')
const compose = read('docker-compose.yml')
const nginx = read('web/nginx.conf.template')

assert(/ARG VITE_SUPABASE_URL/.test(dockerfile) && /ARG VITE_SUPABASE_PUBLISHABLE_KEY/.test(dockerfile), 'web build does not accept public Supabase build args')
assert(/VITE_SUPABASE_URL:\s*\$\{VITE_SUPABASE_URL/.test(compose) && /VITE_SUPABASE_PUBLISHABLE_KEY:\s*\$\{VITE_SUPABASE_PUBLISHABLE_KEY/.test(compose), 'Compose does not pass public Supabase build args')
assert(/connect-src 'self' \$\{SUPABASE_URL\}/.test(nginx), 'nginx CSP does not allow the configured exact Supabase origin')
assert(!/connect-src[^"\n]*\*/.test(nginx), 'nginx CSP contains a wildcard connection source')

const publicUrl = 'https://synthetic-project.supabase.co'
const publicKey = 'sb_publishable_synthetic_only'
execSync('npm --prefix frontend run build', {
  cwd: root,
  stdio: 'ignore',
  env: { ...process.env, VITE_SUPABASE_URL: publicUrl, VITE_SUPABASE_PUBLISHABLE_KEY: publicKey },
})

const dist = join(root, 'frontend', 'dist')
assert(existsSync(dist), 'frontend build did not produce dist')
const assets = []
const walk = directory => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) walk(path)
    else if (/\.js$/.test(entry.name)) assets.push(readFileSync(path, 'utf8'))
  }
}
walk(dist)
const bundle = assets.join('\n')
assert(bundle.includes(publicUrl), 'synthetic public Supabase URL is absent from the enabled bundle')
assert(bundle.includes(publicKey), 'synthetic public Supabase publishable key is absent from the enabled bundle')
console.log('Web Supabase deployment path passed: public build args, bundle injection, and exact-origin CSP are wired.')
