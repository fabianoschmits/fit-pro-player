# Community social foundation design

## Goal

Turn the current photo-led community into a coherent social-training surface without changing its data model or adding unsupported social relationships. The first delivery makes reading, publishing, commenting, profiles, messages and notifications feel like one product on desktop and mobile.

## Scope

This delivery changes the Community route and its presentational components only. It preserves the existing single-photo post model, pagination, likes, comments, private messages and notification schema.

It adds a social page structure: a named community header, compact publishing invitation, clearer feed context, an owned-profile summary on desktop, and a more useful profile heading. The existing controls stay reachable on mobile.

It fixes the visual-token mismatch, modal focus behavior, semantic labels and error/loading states identified in the audit. A failed photo must leave the post author, caption and discussion actions available.

## Non-goals

- Follow relationships, social search, saved posts, groups, challenges, text-only posts, carousels and video.
- Database migrations, storage-policy changes, new notification types or ranking changes.
- Replacing the global corner navigation.
- Changing the public visibility contract of community media.

## Experience design

The page uses the application’s token system (`--label`, `--label-2`, `--acc`, `--on-acc`, `--surface`) rather than standalone colors. The visual emphasis is on people, published training photos and conversation.

The top of the feed contains an `h1` titled “Comunidade”, a short purpose line and the existing message, notification and profile controls. Beneath it, a composer invitation contains the viewer’s avatar and opens the existing photo flow. The feed has a visible “Recentes” context rather than implying an unsupported personalized feed.

At desktop widths, a narrow secondary column shows the viewer’s avatar, name, post count from loaded data and shortcuts to their profile and messages. It is hidden on smaller screens, where the main feed remains the only column.

On another person’s profile, the header clearly states whose posts are being viewed, provides the existing message action and a return action. A missing profile is a distinct unavailable state rather than an endless loading label.

Post cards retain image-first presentation. Action names communicate their current state; like uses `aria-pressed`, contextual labels and a count. The options menu exposes `aria-expanded`. Loading applies only to the image area. On image failure, a contained retry panel replaces that image area without hiding the rest of the card.

Sheets use the existing dialog-focus utility for initial focus, focus containment, Escape behavior and focus restoration. Composer motion remains limited to its existing transform/opacity sheet transition and honors the project-wide reduced-motion CSS.

## Components and data flow

`Community.jsx` remains the session coordinator: it loads profiles/feed data, owns feed mutations and passes page-model values into small presentation regions. The existing `CommunityPostMedia` changes from a full-card gate into a media-only gate. `CommunityComments` adopts the shared dialog focus hook.

No additional backend reads are required. The desktop profile summary derives the post count from the feed currently loaded in memory and must not present it as the account’s total publication count.

## Error and accessibility behavior

- All dialogs must contain and restore focus through `useDialogFocus`.
- The crop editor retains drag interaction and adds keyboard-accessible directional controls to move the crop.
- Composer and comment inputs receive visible labels for assistive technology.
- Loading, unavailable, empty and retry states use explicit status/alert semantics.
- Pointer targets used by toolbar and post controls meet the project’s 44px control convention where space permits.
- The layout must work at 320, 390, 768, 1024 and 1440 CSS pixels, in light/dark themes and all existing accent preferences.

## Validation

Unit tests cover semantic states, profile-unavailable behavior, dialog focus integration hooks and media-failure content continuity. The existing community E2E tests are extended or supplemented to cover desktop/mobile feed layout, composer interaction, working comments and the failed-media retry state. Build and relevant Vitest/Playwright suites must pass.
