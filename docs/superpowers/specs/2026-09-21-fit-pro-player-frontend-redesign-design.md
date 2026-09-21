# Fit Pro Player Frontend Redesign

## Status

Approved design direction. This document defines the UX and technical boundaries for the frontend redesign; it does not change backend contracts or stored data.

## Goal

Transform Fit Pro Player into a focused, mobile-first fitness app that makes the next workout action obvious, reduces cognitive load during training, and gives every existing feature a consistent visual and interaction language.

## Users and success criteria

The primary user is a person using the app on a phone during a workout, often with one hand and limited attention. Success means:

- the user can identify and start/resume the day's workout immediately;
- the active workout keeps exercise, set progress, inputs, and the primary action visible;
- common destinations require fewer competing choices and remain reachable;
- all existing routes, data, authentication, sync, offline/PWA, native shell, themes, languages, and workout behaviors remain available;
- the UI is usable at 320, 360, 375, 390, 414, and 430px widths, then remains coherent on tablet and desktop;
- key interactions have accessible labels, keyboard focus, adequate touch targets, contrast, and reduced-motion behavior.

## Non-goals and constraints

- Do not change API contracts, persisted state shape, synchronization semantics, authentication, Capacitor integrations, or workout domain behavior unless a regression proves it necessary.
- Do not replace the existing React/Vite/React Router/Zustand/Framer Motion stack.
- Do not add a large component library for convenience.
- Do not remove a feature merely because it is secondary; reorganize it into contextual navigation or the More hub.
- Do not use decoration as a substitute for hierarchy. Gradients, shadows, animation, and cards must communicate state or grouping.

## Product architecture

### Primary navigation

The authenticated shell keeps the existing route contracts and lazy-loading behavior while presenting four primary destinations:

1. **Home** (`/home`): today's decision surface, resume/start workout, short progress context, and essential quick actions.
2. **Plan** (`/plan`): routine schedule, routine editing, and profile editing entry points that already live in this domain.
3. **Progress** (`/stats`): the primary progress destination, with direct contextual access to `/history` and `/body-progress`.
4. **More** (`/more`): library, profile, settings, history/evolution shortcuts, and admin when authorized.

The bottom navigation remains persistent for primary destinations. Workout is a contextual action: when a workout is active or available, it is visually emphasized and routes to `/workout`; it must not hide the four destinations. Secondary screens use a compact back header and must not duplicate the global tab bar's meaning.

### Home

Home is a decision surface rather than a dashboard. Its order is:

1. compact profile/context header;
2. today's workout or onboarding/empty state;
3. one dominant start/resume action;
4. concise weekly/progress context;
5. secondary actions and recent history only when useful.

Existing calendar, weigh-in, plan setup, starter plan, history, and profile behaviors remain available through the same actions or an explicitly labeled contextual control.

### Workout

The workout route is optimized for one-handed, fatigued use. The visual sequence is:

1. current exercise and set position;
2. execution guide/media when present;
3. current inputs for weight/repetitions and effort when configured;
4. clear primary completion action;
5. compact next-exercise/progress context.

Rest timer, wake lock, sound, supersets, exercise picker, editing/removal, skip/repeat, recovery behavior, and completion/result states remain intact. Secondary details open in existing sheet/modal infrastructure rather than adding persistent nested cards. Primary controls use safe-area-aware sticky positioning where it does not obstruct the keyboard or exercise content.

### Progress and More

Stats becomes the entry point for trends and recovery. History and Body Progress keep their direct routes and are reached through explicit actions from Stats or More. More is grouped into a small number of labeled sections, with no redundant duplicate rows for the same destination.

## Design system

Tokens remain centralized in `frontend/src/index.css` and are extended/consolidated rather than scattered. The default accent is `#0F8B8D`; it is used for primary actions, progress, selected states, and focus. Dark and light themes share the same semantic token names and hierarchy.

The system will define reusable patterns for:

- page/screen container and contextual header;
- bottom navigation and primary action emphasis;
- section labels, grouped lists, and selective cards;
- primary, secondary, ghost, destructive, and icon buttons;
- text/number fields, segmented controls, chips, and toggles;
- sheets, alerts, toasts, loading/skeleton, empty, error, and success states;
- progress indicators and workout set controls.

Touch targets are at least 44px unless a compact control has an adjacent accessible larger target. Typography uses the existing semantic scale where possible. All motion uses opacity/transform, respects `prefers-reduced-motion`, and communicates a state change.

## Implementation boundaries

The redesign is staged to keep each change testable:

1. shell/navigation primitives and token cleanup;
2. Home, Plan, and More composition;
3. Progress/History/Body Progress composition;
4. Workout composition and sticky action behavior;
5. cross-screen accessibility, responsive polish, and visual cleanup.

Shared components should be extracted only when two or more screens use the same interaction contract. Existing `components/ui.jsx`, `TabBar`, `PageTransition`, `Modals`, `Toast`, sheets, and route lazy loading are preferred extension points.

## Data flow and compatibility

Views continue to read/write through `useStore` and existing helpers. Navigation continues through React Router and the existing `setNav` bridge. No view should mutate persisted state directly outside current store APIs. Any new visual state must be local or live in `useUI` only when it is cross-surface UI state. Existing translations remain the source for user-facing strings; new strings must be added to the locale system and pass the repository i18n checks.

## Error, loading, and empty states

Every redesigned route retains a safe loading fallback, an actionable empty state, and a recoverable error path. Empty states explain the next useful action instead of presenting a blank card. Sync conflicts, offline persistence, and auth failures keep their current semantics and feedback; only their presentation may change.

## Testing and verification

Before implementation, preserve the passing baseline and identify relevant existing tests. Add regression tests for changed navigation labels/actions, Home workout start/resume, More/Progress routing, workout primary action and set persistence, and accessibility-sensitive controls. Run the frontend suite after each staged task, then the full repository test command, i18n checks, production build, `git diff --check`, and a visual browser pass at the specified mobile widths plus desktop in both themes. Review console errors related to the changes.

## Known limitations

Browser automation can validate responsive layout and interaction states, but final native keyboard, safe-area, haptic, and device-specific Capacitor behavior still requires a real phone/tablet pass after implementation.
