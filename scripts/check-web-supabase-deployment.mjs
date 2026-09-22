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
assert(/SUPABASE_URL=\$\{VITE_SUPABASE_URL/.test(compose), 'Compose does not pass the public URL to nginx runtime')

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

const renderedCsp = nginx.replaceAll('${SUPABASE_URL}', publicUrl)
assert(renderedCsp.includes(`connect-src 'self' ${publicUrl};`), 'rendered nginx CSP does not contain the exact synthetic Supabase origin')
assert(!/connect-src[^"\n]*\*/.test(renderedCsp), 'rendered nginx CSP contains a wildcard connection source')

let dockerAvailable = false
try {
  execSync('docker version --format "{{.Server.Version}}"', { cwd: root, stdio: 'ignore' })
  dockerAvailable = true
} catch {
  // Docker is optional in this local gate; the faithful source/template checks remain mandatory.
}

if (dockerAvailable) {
  const image = 'fitproplayer-web-supabase-check'
  execSync(`docker build --no-cache --build-arg VITE_SUPABASE_URL=${publicUrl} --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=${publicKey} -t ${image} -f web/Dockerfile .`, { cwd: root, stdio: 'ignore' })
  const template = execSync(`docker run --rm -e SUPABASE_URL=${publicUrl} ${image} cat /etc/nginx/templates/default.conf.template`, { cwd: root, encoding: 'utf8' })
  assert(template.includes('${SUPABASE_URL}'), 'web image lost the runtime Supabase CSP placeholder')
  execSync(`docker image rm ${image}`, { cwd: root, stdio: 'ignore' })
  console.log('Docker web image build and runtime template checks passed.')
} else {
  console.log('Docker unavailable; source-build, synthetic bundle, Compose mapping, and rendered CSP checks passed.')
}
