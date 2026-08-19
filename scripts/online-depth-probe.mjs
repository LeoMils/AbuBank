#!/usr/bin/env node
/*
 * ONLINE DEPTH PROBE (Item 3) — REAL keyed calls → PREVIEW-class evidence.
 * ════════════════════════════════════════════════════════════════════════════
 * Proves the before/after of the online-depth work against the LIVE providers:
 *   • provider health — which of TAVILY / BRAVE / PERPLEXITY keys actually work
 *   • BEFORE — one query, one-line answer + the few sources we used to surface
 *   • AFTER  — the 6-category briefing fan-out, deduped, distinct headline count
 * Secrets are read from .env and NEVER printed (presence booleans + counts only).
 * Writes docs/eval/ONLINE_DEPTH_PROBE.json. Run: node scripts/online-depth-probe.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnv() {
  const env = {}
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (!m) continue
      let v = m[2]
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
      env[m[1]] = v
    }
  } catch { /* no .env */ }
  return env
}

const env = loadEnv()
const TIMEOUT = 15000
async function withTimeout(p) {
  const c = new AbortController()
  const t = setTimeout(() => c.abort(), TIMEOUT)
  try { return await p(c.signal) } finally { clearTimeout(t) }
}

async function tavily(query, maxResults = 10) {
  const key = env.TAVILY_API_KEY
  if (!key) return { ok: false, error: 'NO_KEY', sources: [] }
  try {
    const res = await withTimeout((signal) => fetch('https://api.tavily.com/search', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, search_depth: 'basic', include_answer: true, max_results: maxResults }),
    }))
    if (!res.ok) return { ok: false, error: `HTTP_${res.status}`, sources: [] }
    const d = await res.json()
    const sources = (d.results ?? []).filter((r) => r.url).map((r) => ({ url: r.url, title: r.title ?? '', content: (r.content ?? '').replace(/\s+/g, ' ').trim() }))
    return { ok: true, answer: (d.answer ?? '').trim(), sources }
  } catch (e) { return { ok: false, error: e?.name === 'AbortError' ? 'TIMEOUT' : 'PROVIDER_FAILED', sources: [] } }
}

async function braveHealth() {
  const key = env.BRAVE_API_KEY
  if (!key) return { key: false, healthy: false, note: 'no key' }
  try {
    const res = await withTimeout((signal) => fetch('https://api.search.brave.com/res/v1/web/search?q=news&count=3', {
      method: 'GET', signal, headers: { Accept: 'application/json', 'X-Subscription-Token': key },
    }))
    if (!res.ok) return { key: true, healthy: false, note: `HTTP ${res.status}` }
    const d = await res.json()
    const n = d?.web?.results?.length ?? 0
    return { key: true, healthy: n > 0, note: `${n} results` }
  } catch (e) { return { key: true, healthy: false, note: e?.name ?? 'error' } }
}

async function perplexityHealth() {
  const key = env.PERPLEXITY_API_KEY
  if (!key) return { key: false, healthy: false, note: 'no key' }
  try {
    const res = await withTimeout((signal) => fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'sonar', messages: [{ role: 'user', content: 'one word: news' }] }),
    }))
    return { key: true, healthy: res.ok, note: res.ok ? 'ok' : `HTTP ${res.status}` }
  } catch (e) { return { key: true, healthy: false, note: e?.name ?? 'error' } }
}

async function brave(query, count = 10) {
  const key = env.BRAVE_API_KEY
  if (!key) return { ok: false, error: 'NO_KEY', sources: [] }
  try {
    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&search_lang=he&count=${count}`
    const res = await withTimeout((signal) => fetch(url, { method: 'GET', signal, headers: { Accept: 'application/json', 'X-Subscription-Token': key } }))
    if (!res.ok) return { ok: false, error: `HTTP_${res.status}`, sources: [] }
    const d = await res.json()
    const sources = (d?.web?.results ?? []).filter((r) => r.url).map((r) => ({ url: r.url, title: r.title ?? '', content: (r.description ?? '').replace(/\s+/g, ' ').trim() }))
    return { ok: true, answer: sources[0]?.content ?? '', sources }
  } catch (e) { return { ok: false, error: e?.name === 'AbortError' ? 'TIMEOUT' : 'PROVIDER_FAILED', sources: [] } }
}

const CATEGORIES = [
  ['israel', 'חדשות ישראל היום עדכון'],
  ['world', 'חדשות העולם היום עדכון'],
  ['culture', 'תרבות ואמנות בישראל היום'],
  ['entertainment', 'בידור ותוכניות טלוויזיה חדשות היום'],
  ['society', 'חברה וקהילה בישראל חדשות היום'],
  ['health', 'בריאות ורפואה טיפים וחדשות היום'],
]
const EXCLUDE = /כדורגל|כדורסל|ליגה|מכבי|הפועל|גביע|ספורט|מונדיאל|בורסה|מניות|מדד|דולר|ריבית|אינפלציה|football|soccer|nasdaq|stocks?|inflation/i
const urlKey = (u) => u.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase()

async function run() {
  const report = { generatedNote: 'real keyed calls; secrets never printed', providerHealth: {}, before: {}, after: {}, cinema: {} }

  // ── Provider health ──
  const t0 = await tavily('news today', 3)
  report.providerHealth.tavily = { key: !!env.TAVILY_API_KEY, healthy: t0.ok && t0.sources.length > 0, note: t0.ok ? `${t0.sources.length} results` : t0.error }
  report.providerHealth.brave = await braveHealth()
  report.providerHealth.perplexity = await perplexityHealth()
  report.providerHealth.openaiKeyPresent = !!env.OPENAI_API_KEY

  // Prove the fan-out against a LIVE provider: Tavily if its key works, else Brave
  // (also live). The briefing orchestrator is provider-agnostic — this only picks
  // whose real results feed the before/after numbers below.
  const tavilyHealthy = report.providerHealth.tavily.healthy
  const SEARCH = tavilyHealthy ? tavily : brave
  report.after = report.after || {}
  report.usedProvider = tavilyHealthy ? 'tavily' : 'brave'

  // ── BEFORE: one query, answer + the handful of sources ──
  const beforeQ = await SEARCH('מה חדש היום', 6)
  report.before = {
    query: 'מה חדש היום',
    ok: beforeQ.ok,
    answerLength: (beforeQ.answer ?? '').length,
    distinctHeadlines: beforeQ.ok ? new Set(beforeQ.sources.map((s) => urlKey(s.url))).size : 0,
    note: 'the old path surfaced ~one synthesized line; sources were url+title only (content discarded)',
  }

  // ── AFTER: 6-category fan-out, deduped, with per-source content ──
  const seen = new Set()
  const perCat = []
  const failed = []
  let withSnippet = 0
  for (const [cat, q] of CATEGORIES) {
    const r = await SEARCH(q, 10)
    if (!r.ok || r.sources.length === 0) { failed.push([cat, r.error ?? 'empty']); continue }
    const items = []
    for (const s of r.sources) {
      if (items.length >= 3) break
      const k = urlKey(s.url)
      if (seen.has(k)) continue
      if (!s.title) continue
      if (EXCLUDE.test(s.title) || EXCLUDE.test(s.content)) continue
      seen.add(k)
      if (s.content) withSnippet++
      items.push({ title: s.title, host: k.split('/')[0], hasSnippet: !!s.content })
    }
    if (items.length) perCat.push([cat, items])
  }
  const headlines = []
  let idx = 0, added = true
  while (headlines.length < 12 && added) {
    added = false
    for (const [cat, items] of perCat) { if (items[idx]) { headlines.push({ ...items[idx], category: cat }); added = true } }
    idx++
  }
  report.after = {
    categoriesQueried: CATEGORIES.length,
    categoriesFailed: failed,
    distinctHeadlines: headlines.length,
    headlinesWithSnippet: headlines.filter((h) => h.hasSnippet).length,
    distinctHosts: new Set(headlines.map((h) => h.host)).size,
    categoriesCovered: [...new Set(headlines.map((h) => h.category))],
    sampleTitles: headlines.slice(0, 12).map((h) => `[${h.category}] ${h.title.slice(0, 60)}`),
  }

  // ── Cinema probe: is there reliable structured Kfar Saba showtimes + plots? ──
  const cine = await SEARCH('לוח הקרנות קולנוע כפר סבא היום סרטים ותקצירים', 10)
  report.cinema = {
    ok: cine.ok,
    resultCount: cine.ok ? cine.sources.length : 0,
    hasShowtimeLikeContent: cine.ok ? cine.sources.some((s) => /שעה|הקרנה|\d{1,2}:\d{2}|כרטיס/.test(s.content || s.title)) : false,
    hosts: cine.ok ? [...new Set(cine.sources.map((s) => urlKey(s.url).split('/')[0]))].slice(0, 8) : [],
    verdict: 'see ONLINE_DEPTH_REPORT.md — general web search vs a structured listings source',
  }

  writeFileSync(join(ROOT, 'docs/eval/ONLINE_DEPTH_PROBE.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}
run().catch((e) => { console.error('PROBE_ERROR', e?.message); process.exit(1) })
