# FPP Motion & Feedback

## Intent and boundaries
Make actions feel precise, immediate and trustworthy while preserving the current FPP identity, layouts, themes, accent colors and business rules. The user's brief explicitly authorizes analysis followed by implementation. Work in the supplied checkout and preserve existing unrelated changes. No new dependencies, backend changes, fake network waits, social feed or upload service.

## Audit
`index.css` already defines surfaces, labels, semantic colors, accent/on-accent, easing, duration and reduced-motion tokens. `ui.jsx` has Button, Check, Switch and form primitives. Toast/useUI already provides a polite live region. Framer Motion is installed. Async professional views currently mix disabled buttons, changing labels and detached status paragraphs; structured loading views lack a shared skeleton. Local routine edits and workout logging persist synchronously. Publication is a professional program version, not a social post. Sharing exports a workout image. Avatar selection uses preset images; existing file inputs import backup data rather than upload media.

## Architecture
Extend the existing Button through `FppPerformanceButton`, preserving `btn`, variant and size classes and existing event semantics. Introduce shared `FppActionFeedback`, `FppProgress`, `FppSpinner`, `FppSkeleton`, `FppToast`, `FppStatusAnimation`, exported from `components/FppFeedback.jsx`. Spinner is opt-in; energy/progress is the default. `components/useFppAction.js` owns async lifetime, synchronous duplicate protection and timer cleanup.

Button interface: existing Button props plus `onAction(event)`, optional controlled `state`, `intent="primary|quick|critical"`, `loadingLabel`, `successLabel`, `errorLabel`, `progress`, `onSuccess(result)`, `onError(error)`. `onAction` resolves normally for success, returns `false` for validation/cancellation, rejects for failure. Existing `onClick` remains compatible without interpreting swallowed errors as success. Native form submits use controlled state and a synchronous guard in their form handler. Critical actions use existing confirmation sheets/dialogs; intent alone never executes a destructive action without the call site's existing confirmation.

States: idle, pressed, loading, processing, success, error, disabled, uploading, syncing, offline, warning. Immediately lock pending actions and expose aria-busy. Delay only the busy visual by 220 ms; preserve success until a short feedback reset (900 ms) with a 280 ms presentation hold before same-screen success observers. The mutation and network request still start on the same click; reduced-motion users skip the presentation hold. Allow retry immediately on error. Retain all state labels invisibly in one grid to reserve maximum natural width. Local quick actions keep their immediate business result while their visual response has a readable transition.

## Motion and accessibility
Primary Emil (frequency/speed), secondary Jakub (subtle production polish). Press 100 ms, transition 180–260 ms, check 480 ms; success is a check plus text, error is an icon plus retry text. Use transform/opacity for running motion. Progress uses scaleX, unknown progress uses a low-opacity internal energy rail without fabricated percentages. Reduced motion disables movement, retains text/icons and a static progress indicator. Busy/disabled prevent pointer and keyboard activation. Status output uses polite aria-live; errors use an accessible error message without color dependence. All styles consume the existing tokens.

## Rollout
1. Reusable foundation, compatibility tests and developer showcase at `#/motion-feedback`.
2. Test light/dark and all nine accent colors, reduced motion and fixed label width.
3. Migrate explicit local exercise saving, local workout completion and set logging; do not label local persistence as cloud synchronization.
4. Migrate invitation creation/revocation/copy, professional program publication/metadata save and profile writes.
5. Extend established auth, offline preparation, sync conflict, import/share, measurements and structured loading surfaces where applicable. Shared Button/Check/Switch improvements propagate throughout the app.

## Verification
Baseline: 125 files / 989 tests pass. Add meaningful action concurrency, fast-resolution, rejection/retry, cancellation, controlled state and unmount tests. Retain existing workout/timer and professional repository tests. Browser checks cover real CSS/theme tokens, button geometry, keyboard, reduced motion, showcase states and representative migrated flows. Run full unit suite, build, localization checks and targeted Playwright checks. Document remaining call sites for gradual migration rather than adding nonexistent features.
