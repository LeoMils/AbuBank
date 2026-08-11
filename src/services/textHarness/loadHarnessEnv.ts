/*
 * loadHarnessEnv.ts — make the harness's credential reachable without a shell export.
 * ════════════════════════════════════════════════════════════════════════════
 * vitest does NOT auto-load .env files, so a direct `vitest run report.test.ts`
 * (or a device/online probe) saw no OPENAI_API_KEY and fell back to the BLOCKED
 * driver — even though the key is right here in .env.local/.env. That produced a
 * FALSE "BLOCKED" when the key was reachable. This is the single loader both the
 * gate script (scripts/text-harness-report.ts) and the report test use, so a run
 * is only ever BLOCKED when the key is genuinely absent — never faked, never falsely
 * blocked.
 *
 * Only a fixed allow-list is honoured (never a blind dump of the env file):
 *   OPENAI_API_KEY     — the server-side key the live path + harness read
 *   TEXT_HARNESS_MODEL — optional model override
 *   TAVILY_API_KEY / BRAVE_API_KEY / PERPLEXITY_API_KEY — the online bake-off
 *     candidates (server-side only; this loader is node-only, never bundled to the
 *     client). Present so `scripts/online-bakeoff.ts` runs the REAL tournament off
 *     the local keys instead of falsely recording keyed providers as BLOCKED.
 * Precedence: an already-exported process.env value wins, then .env.local, then
 * .env. The literal placeholder PUT_KEY_HERE (and empty) is treated as UNSET.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const ALLOWED_KEYS = ['OPENAI_API_KEY', 'TEXT_HARNESS_MODEL', 'TAVILY_API_KEY', 'BRAVE_API_KEY', 'PERPLEXITY_API_KEY'] as const

/** Load the allowed keys from .env.local then .env into process.env (idempotent).
 *  Returns true if OPENAI_API_KEY is set afterwards (i.e. a real run is possible). */
export function loadHarnessEnv(repo: string = DEFAULT_REPO): boolean {
  for (const rel of ['.env.local', '.env']) { // .env.local overrides .env (Vite semantics)
    const p = resolve(repo, rel)
    if (!existsSync(p)) continue
    let text: string
    try { text = readFileSync(p, 'utf8') } catch { continue }
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      if (!(ALLOWED_KEYS as readonly string[]).includes(k)) continue
      if (process.env[k]) continue // already set (export or earlier file) wins
      const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '')
      if (!v || v === 'PUT_KEY_HERE') continue // placeholder / empty → leave unset
      process.env[k] = v
    }
  }
  return !!process.env.OPENAI_API_KEY
}
