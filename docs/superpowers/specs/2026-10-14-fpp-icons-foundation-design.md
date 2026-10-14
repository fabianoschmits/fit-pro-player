# FPP Icons — Foundation Design

## Goal

Create the first, reviewable foundation of the Fit Pro Player icon library: a documented inventory, three visually consistent workout SVGs, a lightweight React renderer, and a development gallery. This delivery stops after `workout-push`, `workout-pull`, and `workout-legs` so the visual language can be approved before expanding the library.

## Context

The frontend is a React 19 + Vite application with Capacitor support. Its design tokens live in `frontend/src/index.css`; icons use `currentColor`, no fill, rounded joins/caps, and `--icon-stroke: 1.7`. The app supports dark/light themes and per-account accent colors. Muscle identifiers are defined canonically in `frontend/src/lib/muscles.js`.

The Plan view already exposes small icon slots such as `.plan-day-icon` and `.daily-plan-icon`, so the initial workout icons must remain legible at small sizes without changing Plan behavior in this phase.

## Scope

### Included

- Repository-wide inventory of existing icon-like UI, SVGs, emojis, Unicode symbols, BodyMap references, Plan/workout/statistics references, and candidate replacement locations.
- `ICON-INVENTORY.md` with the requested fields: name, file, category, meaning, intended usage, existing/new, and status.
- FPP icon directory structure under `frontend/src/assets/icons/fpp/`.
- Three original SVGs:
  - `workouts/workout-push.svg`
  - `workouts/workout-pull.svg`
  - `workouts/workout-legs.svg`
- Shared SVG conventions: `viewBox="0 0 24 24"`, `currentColor`, no raster/image/base64/text, rounded line geometry, and no fixed brand color.
- A manifest containing metadata for the three icons.
- `FppIcon` React component with `name`, `size`, `className`, `title`, and `aria-hidden` support.
- A non-production-facing FPP Icon Gallery showing the three icons in five sizes, light/dark surfaces, and normal/accent states.
- Focused automated tests and an SVG validation script.

### Excluded

- The remaining workout, body, muscle, exercise, equipment, or UI icons.
- Automatic replacement of existing icons or emojis.
- Changes to BodyMap geometry or behavior.
- New runtime dependencies.
- Production navigation changes beyond the minimum route/access mechanism needed for the development gallery.
- ZIP packaging; that belongs to the later complete-library delivery.

## Visual language

The three icons form the reference family for later work. They will use a compact 24×24 construction with a shared optical scale, margins, stroke weight, rounded caps/joins, and low-to-medium detail.

- Push: front-facing upper torso with chest/shoulder emphasis and a distinct forward/pushing gesture.
- Pull: rear-facing upper torso/back emphasis with a distinct pulling gesture.
- Legs: simplified lower-body silhouette with both legs as the dominant visual mass.

The icons must be recognizable at 20–24 px and remain coherent at 16, 32, and 48 px. SVG classes `fpp-icon-base` and `fpp-icon-target` may be used so a later two-tone treatment can be added without changing the files, while the default remains usable as a single color.

## Architecture

SVG source files remain the single source of truth. `manifest.json` describes them, `index.js` exposes the manifest/resolution data, and `FppIcon.jsx` renders the selected SVG through the existing Vite asset pipeline. The component must not introduce an icon package or duplicate SVG markup in React.

The gallery is a development-only view/component. It uses existing app tokens rather than introducing a second theme system. It should be reachable for local review without becoming a normal product destination; the implementation may use a guarded route or an equivalent development-only entry consistent with the current `HashRouter` structure.

## Accessibility and behavior

- Decorative icons default to `aria-hidden="true"` when no title is supplied.
- A supplied `title` makes the SVG identifiable and removes decorative-only behavior unless explicitly overridden.
- `size` controls width and height while preserving the 24×24 viewBox.
- Unknown icon names fail clearly and locally rather than silently rendering an unrelated icon.
- CSS color controls appearance; SVGs do not hard-code `#0F8B8D` or other palette colors.

## Verification

The implementation is complete for this phase only when:

- The inventory covers the repository search scope and identifies existing versus new icons.
- All three SVGs pass structural validation.
- The manifest lists each SVG exactly once with semantic metadata.
- Component tests cover name resolution, size, classes, title, and decorative accessibility behavior.
- The gallery visibly renders all three icons at 16/20/24/32/48 px in both theme surfaces and accent state.
- The existing frontend test suite and production build pass.
- No existing Plan, BodyMap, or workout behavior is changed.

## Known follow-up

After visual review and approval of these three icons, the next phase can add the remaining workout icons, then the body and muscle groups, while using this family as the visual reference. The complete library can then add reproducible ZIP packaging.
