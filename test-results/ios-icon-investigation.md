# iPhone native installer icon investigation — 2026-10-18

Status: native sheet F-monogram reproduced by user's screenshot in Chrome on iPhone;
user also confirms Safari F and direct exact PNG displays lion. Inline candidate
now deployed; native confirmation pending. Do not infer native installer success from HTTP
success, Playwright WebKit decoding, or Chromium installability checks.

Current production commit: dd5c12a33af63114fdb5ef7c244b6b557459ecd9.
Current production deployment: dpl_CQMfwxEsPeaZKbDgvDE8tvdVhcz3.

Evidence:

- ios-icon-http-audit.json:54 no-cookie fetches covering6 UA variants and9 paths.
  HTML, manifest, explicit touch PNG, maskable PNG, root touch and precomposed,
  favicon all200 with correct types. Missing sized autodiscovery paths404;
  existing unsized and explicit links work, so missing sizes alone is not a cause.
- Fresh Playwright WebKit26.6 iPhone context parses correct icon links and
  Image.decode succeeds for180x180 RGB Apple PNG and regular favicons, no CSP
  or network errors. Cannot open native iOS Add to Home Screen on Windows.
- Native-style Apple CFNetwork, Safari and CriOS requests receive same bytes;
  icon is46278 bytes, no alpha or ancillary PNG profiles, no redirect at www.
- Vercel WAF API active:null,draft:null,versions:[],24h event list empty and
  blocked/challenged counters0. No challenge headers. Do not change security.
- SSO protects immutable deployment hostname, not canonical www.fitpp.com.br.
- Built Vite relative ./icons paths resolve correctly at root and hash routes.
  WebKit's link collector resolves href before passing URLs to Safari.

Relevant primary sources:

- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
  Monogram means no usable icon selected; Apple touch icon takes precedence.
- https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html
  Explicit touch link and unsized root fallback are valid.
- https://chromium.googlesource.com/chromium/src/+/main/ios/chrome/browser/sharing/ui_bundled/activity_services/activity_service_coordinator.mm
  Sharing also passes actual webState activity item/WKWebView to native controller.
- https://chromium.googlesource.com/chromium/src/+/main/ios/chrome/browser/sharing/ui_bundled/activity_services/data/share_to_data_builder.mm
  LPLinkMetadata iconProvider uses favicon status; imageProvider is snapshot.
- https://chromium.googlesource.com/chromium/src/+/main/components/favicon/core/favicon_driver_impl.cc
  Both ordinary and touch-largest handlers enabled on iOS.
- https://chromium.googlesource.com/chromium/src/+/main/skia/ext/skia_utils_ios.mm
  Favicon decoder max192; large ICO frames skipped. Adding512 PNG alone is
  not supported as a fix; existing Apple180 already fits decoder limits.

Real-device evidence:

1. iOS version; browser confirmed Chrome.
2. Direct https://www.fitpp.com.br/icons/lion-794daf1cde13-180.png displays lion (user confirmed).
3. Same-phone Safari preview shows F too (user confirmed).
4. Post-inline fix test URL https://www.fitpp.com.br/?pwa-icon=inline-v1 asked asynchronously; awaiting native result.

Candidate implemented and deployed: Vite transform embeds same Apple180 PNG as
precomposed data URL, ordinary external180 preserved for older iOS. Safari26
explicitly added data-icon support; LinkIconCollector accepts data and prefers
precomposed at equal180. This bypasses separate native image download without
changing the artwork or app identity. Primary WebKit links in docs/PWA-BRANDING.

Commit f4d622ab4d58efe3c5409f579e6407a26a9a03e6 pushed atomically master/main.
Manual deployment dpl_D12iX5wbzqpLjiE19oxRFqnpMcKf READY onwww beforecommit.
1160 tests passed (139files), production build passed, PWA offline e2e passed.
ios-inline-live-verification.json confirms current published HTML contains exact
46278byte PNG and WebKit decodes it with all externalrequestsblocked, CSP applied.
nativeSheetVerified remainsfalse until phoneconfirmation. SWversionv24 active.
