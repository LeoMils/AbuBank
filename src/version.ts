/*
 * AbuBank — build identity. Single source of truth for the visible version
 * label, branch hint, and operator-readable build name. Imported by main.tsx
 * (startup console.info) and by Settings/About (visible badge).
 *
 * IMPORTANT
 * - This is a build-identity surface, NOT a feature flag.
 * - Do not store secrets, tokens, or private data here.
 * - Bump `version` and `buildDate` each time a new operator-testable build ships.
 * - The package.json semver is exposed separately as `import.meta.env.VITE_APP_VERSION`.
 */

export const APP_VERSION = {
  appName:    'AbuBank',
  version:    '0.153.3-abu-ela-brand',
  buildLabel: 'AbuBank — ABU_ELA_BRAND (session 17). The app is renamed AbuBank to Abu-ela across every user-facing surface: the Home wordmark logo (Abu kept as the teal-serif anchor, a fine metallic connector, and "ela" in a deliberately different voice — modern, lowercase, wide-tracked, champagne to rose-gold shimmer: strong presence, elegant, quietly luxurious), the document + Apple web-app title, the PWA manifest name/short_name (public/manifest.json and the vite manifest), and the Settings About label. Internal code identifiers (classifyAbuBankIntent, module comments) and the operator build identity are unchanged. Evidence: CODE typecheck + build; BROWSER screenshot of the Home header. Builds on 0.153.2.',
  buildDate:  '2026-07-27',
  branchHint: 'rc5/cognitive-architecture-and-acceptance',
  commitHint: 'local',
} as const

export type AppVersion = typeof APP_VERSION
