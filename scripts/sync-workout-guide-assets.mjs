import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  WORKOUT_GUIDE_COMMIT,
  WORKOUT_GUIDE_SLUGS,
  WORKOUT_GUIDE_VERSION,
} from '../frontend/src/lib/exercise-guide-assets.js'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const checkoutRoot = resolve(process.argv[2] || join(projectRoot, '.tmp-workout-guide'))
const packageRoot = join(checkoutRoot, 'packages', 'workout-guide')
const targetRoot = join(projectRoot, 'frontend', 'src', 'assets', 'workout-guide')
const execFileAsync = promisify(execFile)

if (!targetRoot.startsWith(projectRoot + sep)) throw new Error('Refusing to write outside the project')

const { stdout: sourceCommit } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: checkoutRoot })
if (sourceCommit.trim() !== WORKOUT_GUIDE_COMMIT) {
  throw new Error(`Expected Workout Guide commit ${WORKOUT_GUIDE_COMMIT}, found ${sourceCommit.trim()}`)
}

const packageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
if (packageJson.version !== WORKOUT_GUIDE_VERSION) {
  throw new Error(`Expected Workout Guide ${WORKOUT_GUIDE_VERSION}, found ${packageJson.version}`)
}

const manifest = JSON.parse(await readFile(join(packageRoot, 'manifest.json'), 'utf8'))
const bySlug = new Map(manifest.map(exercise => [exercise.slug, exercise]))
const selected = WORKOUT_GUIDE_SLUGS.map(slug => {
  const exercise = bySlug.get(slug)
  if (!exercise) throw new Error(`Mapped Workout Guide exercise is missing: ${slug}`)
  if (exercise.frames.length !== 3) throw new Error(`${slug} does not have exactly three frames`)
  return exercise
})

await rm(targetRoot, { force: true, recursive: true })
await mkdir(targetRoot, { recursive: true })

for (const exercise of selected) {
  const destination = join(targetRoot, exercise.slug)
  await mkdir(destination, { recursive: true })
  const frames = []
  for (const frame of exercise.frames) {
    const source = join(packageRoot, frame.path)
    frames.push(await readFile(source, 'utf8'))
  }
  const moduleSource = [
    '// Exact SVG frames from Workout Guide; CC BY-SA 4.0. See repository THIRD_PARTY_ASSETS.md.',
    `const FRAMES = Object.freeze(${JSON.stringify(frames)})`,
    'export default FRAMES',
    '',
  ].join('\n')
  await writeFile(join(destination, 'frames.js'), moduleSource, 'utf8')
}

const provenance = {
  source: 'https://github.com/bryllim/workout-guide',
  sourceCommit: WORKOUT_GUIDE_COMMIT,
  sourceVersion: WORKOUT_GUIDE_VERSION,
  assetLicense: 'CC BY-SA 4.0',
  assetLicenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  importedExerciseCount: selected.length,
  importedFrameCount: selected.length * 3,
  exercises: selected,
}
await writeFile(join(targetRoot, 'manifest.json'), `${JSON.stringify(provenance, null, 2)}\n`, 'utf8')

for (const filename of ['ATTRIBUTION.md', 'LICENSE-ASSETS', 'LICENSES.md']) {
  await copyFile(join(packageRoot, filename), join(targetRoot, filename))
}

console.log(`Embedded ${selected.length} Workout Guide exercises (${selected.length * 3} SVG frames).`)
console.log(`Target: ${relative(projectRoot, targetRoot)}`)
