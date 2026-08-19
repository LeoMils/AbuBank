/*
 * check-prod-auth-config.mjs — FAIL-CLOSED production build gate. (Task C)
 * ════════════════════════════════════════════════════════════════════════════
 * A PRODUCTION deployment must NEVER ship with the billable/private APIs open.
 * This runs at the start of `npm run build`; on Vercel VERCEL_ENV is set
 * ('production' | 'preview' | 'development'). If a PRODUCTION build lacks either
 * AUTH_SIGNING_SECRET or ENROLLMENT_SECRET, the build FAILS — a future production
 * deploy therefore cannot run with authEnforced=false. Preview/local builds do
 * not require the secrets (they run in explicit dev/test mode, or set them per
 * deploy), so this never blocks non-production builds.
 */
const env = process.env
const vercelEnv = env.VERCEL_ENV || 'local'
const isProd = vercelEnv === 'production'
const hasAuth = (env.AUTH_SIGNING_SECRET || '').length >= 16
const hasEnroll = (env.ENROLLMENT_SECRET || '').length >= 8

if (isProd && !(hasAuth && hasEnroll)) {
  const missing = [!hasAuth && 'AUTH_SIGNING_SECRET', !hasEnroll && 'ENROLLMENT_SECRET'].filter(Boolean).join(', ')
  console.error(`❌ PRODUCTION build BLOCKED — server-verified auth must be configured before a production deploy.`)
  console.error(`   Missing/short: ${missing}. Set these as durable Production project env, then redeploy.`)
  console.error(`   (This gate exists so a Production build can never ship with authEnforced=false.)`)
  process.exit(1)
}

console.log(
  `✅ prod-auth-config gate: env=${vercelEnv} — ` +
    (isProd ? 'PRODUCTION, both auth secrets present' : 'non-production (secrets not required at build)'),
)
