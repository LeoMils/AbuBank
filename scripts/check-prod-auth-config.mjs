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
// A DISTRIBUTED single-use store is auth-correctness, not a rate-limit nicety: production
// must have it or global WebAuthn replay protection is not guaranteed.
const hasKv = Boolean((env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL) && (env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN))

if (isProd && !(hasAuth && hasEnroll && hasKv)) {
  const missing = [
    !hasAuth && 'AUTH_SIGNING_SECRET',
    !hasEnroll && 'ENROLLMENT_SECRET',
    !hasKv && 'KV_REST_API_URL+KV_REST_API_TOKEN (distributed replay store)',
  ].filter(Boolean).join(', ')
  console.error(`❌ PRODUCTION build BLOCKED — server-verified auth + distributed replay protection must be configured.`)
  console.error(`   Missing: ${missing}. Set these as durable Production project env, then redeploy.`)
  console.error(`   (Gate: a Production build can never ship authEnforced=false OR without GLOBAL single-use replay protection.)`)
  process.exit(1)
}

console.log(
  `✅ prod-auth-config gate: env=${vercelEnv} — ` +
    (isProd ? 'PRODUCTION: auth secrets + distributed replay store present' : 'non-production (not required at build)'),
)
