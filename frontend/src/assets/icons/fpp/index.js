import manifest from './manifest.json'

export const FPP_ICON_MANIFEST = manifest
export const FPP_ICON_NAMES = manifest.map(icon => icon.id)
export const FPP_ICON_PATHS = Object.fromEntries(manifest.map(icon => [icon.id, `/src/assets/icons/fpp/${icon.file}`]))
export function iconMetadata(name) { return manifest.find(icon => icon.id === name) || null }
