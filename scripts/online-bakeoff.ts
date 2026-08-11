/*
 * online-bakeoff.ts — the empirical provider tournament (M1).
 * Loads the local keys, runs the Hebrew(+Spanish) corpus against every provider whose
 * key is present (never faked — a keyless provider is recorded BLOCKED), and writes a
 * scored matrix to docs/eval/ONLINE_BAKEOFF.json. Metrics: citation rate (grounded),
 * answer rate, and latency (this feeds a VOICE turn). Cost is documented, not invented.
 */
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadHarnessEnv } from '../src/services/textHarness/loadHarnessEnv'
import { ALL_PROVIDERS } from '../src/services/online/registry'
import { BAKEOFF_CORPUS } from '../src/services/online/corpus'

loadHarnessEnv()
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(REPO, 'docs', 'eval', 'ONLINE_BAKEOFF.json')
const env = process.env
const CONCURRENCY = 4

async function pool<T, R>(items: readonly T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length) as R[]
  let i = 0
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx]!) }
  }))
  return out
}

function pct(n: number, d: number): number { return d ? Math.round((n / d) * 100) : 0 }

const matrix: Record<string, unknown>[] = []
for (const p of ALL_PROVIDERS) {
  if (!p.available(env)) {
    console.log(`  ${p.id.padEnd(11)} BLOCKED — no ${p.keyEnv}`)
    matrix.push({ provider: p.id, status: 'BLOCKED', reason: `no ${p.keyEnv}` })
    continue
  }
  console.log(`  ${p.id.padEnd(11)} running ${BAKEOFF_CORPUS.length} queries…`)
  const results = await pool(BAKEOFF_CORPUS, CONCURRENCY, async (c) => ({ c, r: await p.search(c.q, c.lang, env) }))
  const ok = results.filter((x) => x.r.ok)
  const grounded = ok.filter((x) => x.r.sources.length > 0)
  const answered = ok.filter((x) => (x.r.answer ?? '').trim().length > 0)
  const lat = ok.map((x) => x.r.latencyMs).sort((a, b) => a - b)
  const byCat: Record<string, { total: number; grounded: number }> = {}
  for (const x of results) {
    const cat = x.c.category
    byCat[cat] ??= { total: 0, grounded: 0 }
    byCat[cat].total++
    if (x.r.ok && x.r.sources.length > 0) byCat[cat].grounded++
  }
  const row = {
    provider: p.id,
    status: 'RAN',
    total: results.length,
    citationRatePct: pct(grounded.length, results.length),
    answerRatePct: pct(answered.length, results.length),
    avgLatencyMs: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : null,
    p95LatencyMs: lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))] : null,
    citationByCategoryPct: Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, pct(v.grounded, v.total)])),
  }
  matrix.push(row)
  console.log(`    citation ${row.citationRatePct}% · answer ${row.answerRatePct}% · avg ${row.avgLatencyMs}ms · p95 ${row.p95LatencyMs}ms`)
}

writeFileSync(OUT, JSON.stringify({ corpusSize: BAKEOFF_CORPUS.length, providers: matrix }, null, 2) + '\n', 'utf8')
console.log(`\nwrote ${OUT}`)
