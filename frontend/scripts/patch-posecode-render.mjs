import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// posecode-render 0.4.2 frames every pose from a low standing camera. That makes
// supine/prone movements look almost flat and leaves too much empty space. Keep
// the dependency pinned and apply this small, verified source patch after each
// clean install until the renderer exposes camera presets in its public API.
const target = fileURLToPath(new URL('../node_modules/posecode-render/dist/index.js', import.meta.url))

if (!existsSync(target)) {
  throw new Error('posecode-render não foi instalado; não foi possível calibrar a câmera.')
}

const before = `        const radius = Math.max(size.x, size.y, size.z, 1.8) * 0.5 + travel;
        const dist = (radius / Math.sin((camera.fov * DEG) / 2)) * 1.15 + 0.3;
        desiredTarget.copy(center);
        desiredTarget.y = Math.max(center.y, 0.55);
        desiredPos.set(center.x + dist * 0.55, Math.max(center.y + radius * 0.5, 1.0), center.z + dist);
        easeCamera = true;`

const previousPatch = `        const radius = Math.max(size.x, size.y, size.z, 1.8) * 0.5 + travel;
        const dist = (radius / Math.sin((camera.fov * DEG) / 2)) * 0.98 + 0.24;
        const horizontalPose = size.y < Math.max(size.x, size.z) * 0.82;
        desiredTarget.copy(center);
        desiredTarget.y = Math.max(center.y, horizontalPose ? 0.34 : 0.55);
        if (horizontalPose) {
            // Floor exercises need a higher camera so joint angles and torso
            // movement remain readable instead of collapsing into a side-on line.
            desiredPos.set(center.x + dist * 0.34, center.y + dist * 0.62, center.z + dist * 0.7);
        }
        else {
            desiredPos.set(center.x + dist * 0.43, Math.max(center.y + dist * 0.24, 1.05), center.z + dist * 0.84);
        }
        easeCamera = true;`

const tightPatch = `        const radius = Math.max(size.x, size.y, size.z, 1.8) * 0.5 + travel;
        const dist = (radius / Math.sin((camera.fov * DEG) / 2)) * 0.64 + 0.1;
        const horizontalPose = size.y < Math.max(size.x, size.z) * 0.82;
        desiredTarget.copy(center);
        desiredTarget.y = Math.max(center.y, horizontalPose ? 0.34 : 0.55);
        if (horizontalPose) {
            // Floor exercises need a higher camera so joint angles and torso
            // movement remain readable instead of collapsing into a side-on line.
            desiredPos.set(center.x + dist * 0.34, center.y + dist * 0.62, center.z + dist * 0.7);
        }
        else {
            desiredPos.set(center.x + dist * 0.43, Math.max(center.y + dist * 0.24, 1.05), center.z + dist * 0.84);
        }
        easeCamera = true;`

const balancedPatch = `        const radius = Math.max(size.x, size.y, size.z, 1.8) * 0.5 + travel;
        const dist = (radius / Math.sin((camera.fov * DEG) / 2)) * 0.92 + 0.18;
        const horizontalPose = size.y < Math.max(size.x, size.z) * 0.82;
        desiredTarget.copy(center);
        desiredTarget.y = Math.max(center.y, horizontalPose ? 0.34 : 0.55);
        if (horizontalPose) {
            // Floor exercises need a higher camera so joint angles and torso
            // movement remain readable instead of collapsing into a side-on line.
            desiredPos.set(center.x + dist * 0.34, center.y + dist * 0.62, center.z + dist * 0.7);
        }
        else {
            desiredPos.set(center.x + dist * 0.43, Math.max(center.y + dist * 0.24, 1.05), center.z + dist * 0.84);
        }
        easeCamera = true;`

const after = `        const radius = Math.max(size.x, size.y, size.z, 1.8) * 0.5 + travel;
        const fitScale = propScene ? 1.06 : 0.92;
        const dist = (radius / Math.sin((camera.fov * DEG) / 2)) * fitScale + 0.18;
        const horizontalPose = size.y < Math.max(size.x, size.z) * 0.82;
        desiredTarget.copy(center);
        desiredTarget.y = Math.max(center.y, horizontalPose ? 0.34 : 0.55);
        if (horizontalPose) {
            // A moderately elevated side view preserves floor contact while
            // keeping the torso and joint angles readable.
            desiredPos.set(center.x + dist * 0.34, center.y + dist * 0.44, center.z + dist * 0.82);
        }
        else {
            desiredPos.set(center.x + dist * 0.43, Math.max(center.y + dist * 0.24, 1.05), center.z + dist * 0.84);
        }
        easeCamera = true;`

let source = readFileSync(target, 'utf8')
if (source.includes(after)) {
  console.log('Câmera do Posecode já está calibrada para o Fit Pro Player.')
} else if ([before, previousPatch, tightPatch, balancedPatch].some(candidate => source.includes(candidate))) {
  const installed = [before, previousPatch, tightPatch, balancedPatch].find(candidate => source.includes(candidate))
  source = source.replace(installed, after)
  console.log('Câmera do Posecode calibrada para poses em pé e no chão.')
} else {
  throw new Error('posecode-render mudou; a calibração de câmera precisa ser revisada com segurança.')
}

// Three.js 0.185 treats PCFSoftShadowMap as the regular PCF mode and warns on
// every player creation. Use the supported constant without changing rendering.
source = source.replace('renderer.shadowMap.type = THREE.PCFSoftShadowMap;', 'renderer.shadowMap.type = THREE.PCFShadowMap;')
writeFileSync(target, source)
