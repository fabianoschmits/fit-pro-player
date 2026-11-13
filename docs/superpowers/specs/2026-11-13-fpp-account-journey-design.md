# FPP account and first-use journey
User approved the proposed complete redesign on 2026-11-13 and authorized full implementation without further design checkpoints. Focus: training and student coaching.

## Outcome
One coherent FPP experience from welcome to account access and completed setup. One account may train and coach. Existing accounts and professional relationships retain their data.

## Design
Use official FPP logo, anatomy/BodyMap and training cues rather than decorative stock imagery. Palette: black #000000, graphite #1C1C1E, teal #0F8B8D, white #FFFFFF, muted #A7B3B8; light theme uses existing system tokens. Existing system sans, strong compact headings, quiet form surfaces. Mobile single column with safe-area-aware actions and keyboard room; desktop branded visual column and focused form. Clear labels and visible keyboard focus. Short functional opacity/transform transitions, reduced-motion supported.

## Authentication
Welcome has direct Entrar / Criar conta choices and optional local entry. Signup starts with explicit Quero treinar / Quero acompanhar alunos choices, not a select. Account basics name/email/password+confirmation/terms; phone optional may be placed in expandable complementary section. Do not persist passwords. Professional presentation is completed after authenticated account creation, not a long pre-account form.
Dedicated confirmation state shows destination email, resend (cooldown and errors), and return to login. Recovery has sent state and reset completion. Preserve invitation context and existing account/session ownership guards. Public privacy/terms/rights remain accessible before setup completes.

## First use
New /onboarding route gates incomplete setup while allowing public documents and invite routes. Do not change PlanWizard editing behavior.
Training: choose own plan or follow a professional; profile goal/experience/starting weight for generated plan, optional avatar/body/birth date/height/target weight with unset values; schedule mode/duration/days; review; finish and open plan. Coach path skips generated personal plan, completes basic setup and opens professional connection. No invented birth date; body choice explicit where collected.
Professional: presentation/name/bio/specialties; location/registration and optional contact; review; persist via existing repository; finish with dashboard/invite/model actions, without personal measurements. Profile save must succeed before completion, and failed provision remains resumable.
Persist non-secret setup draft and step inside account-scoped store state after advancing, flush before showing saved progress, keep incomplete flag until success. Never reuse another account's draft. Existing completed setups are untouched. Draft saves must not alter active plans. Completion clears draft and has explicit final action.

## Scope
Existing professional fields and capabilities are the initial complete supported profile. Online/presential, audience and external links are future schema additions, not falsely stored in bio or unsupported UI. No automatic verification promises: declared register remains unverified until system review.
No new external dependencies, no live account creation during verification, no production database mutations.
