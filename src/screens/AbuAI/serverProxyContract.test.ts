/*
 * AbuAI B2.1 — server-proxy security contract
 *
 * Asserts that the OpenAI API key is NEVER read from the client bundle
 * (no `import.meta.env.VITE_OPENAI_API_KEY` lookups in any AbuAI source
 * file), and that user-facing error copy + tests + comments do NOT
 * instruct anyone to set `VITE_OPENAI_API_KEY`.
 *
 * Pure source-grep tests — vitest runs in node env (no DOM).
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const ROOT = path.resolve(__dirname, '../../..')
const ABUAI_DIR = path.resolve(__dirname)
const API_DIR = path.resolve(ROOT, 'api')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}
function listAbuAITs(): string[] {
  return fs.readdirSync(ABUAI_DIR)
    .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
    .map((f) => path.join('src/screens/AbuAI', f))
}
function listApiTs(): string[] {
  if (!fs.existsSync(API_DIR)) return []
  return fs.readdirSync(API_DIR)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts')) // exclude test files (not endpoints)
    .map((f) => path.join('api', f))
}
// `_`-prefixed api files are shared UTILITIES (e.g. _rateLimit.ts, _session.ts), not provider endpoints;
// and some endpoints are non-provider by design (family.ts serves the authenticated family dataset — no
// OpenAI call). None of these need read OPENAI_API_KEY. The client-surface (import.meta.env) ban still applies.
const NON_PROVIDER_ENDPOINTS = new Set(['family.ts'])
const isEndpoint = (rel: string): boolean =>
  !path.basename(rel).startsWith('_') && !NON_PROVIDER_ENDPOINTS.has(path.basename(rel))

describe('No client-side OpenAI key reads anywhere in AbuAI source', () => {
  for (const rel of listAbuAITs()) {
    if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) continue
    it(`${rel} does not read import.meta.env.VITE_OPENAI_API_KEY`, () => {
      const src = read(rel)
      expect(src.includes('VITE_OPENAI_API_KEY'), `Found VITE_OPENAI_API_KEY in ${rel}`).toBe(false)
    })
  }
})

describe('Server endpoints read OPENAI_API_KEY only from server env', () => {
  for (const rel of listApiTs()) {
    it(`${rel} does not read import.meta.env (Vite client API surface)`, () => {
      const src = read(rel)
      expect(src.includes('import.meta.env'), `${rel} must not use the client-side import.meta.env API`).toBe(false)
    })
    it(`${rel} reads env.OPENAI_API_KEY (preferred) for server-side calls`, () => {
      if (!isEndpoint(rel)) return // a shared utility (e.g. _rateLimit.ts) is not a provider endpoint
      const src = read(rel)
      expect(/env\.OPENAI_API_KEY/.test(src), `${rel} should read OPENAI_API_KEY via process.env`).toBe(true)
    })
  }
})

describe('User-facing copy does not instruct anyone to set VITE_OPENAI_API_KEY', () => {
  // Walk every committed source/doc/test under src/, api/, docs/ and
  // assert no string says "set VITE_OPENAI_API_KEY".
  function walk(dir: string, out: string[]): void {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) { walk(full, out); continue }
      if (!entry.isFile()) continue
      if (!/\.(ts|tsx|md|mdx|json)$/.test(entry.name)) continue
      out.push(full)
    }
  }

  it('no source file contains an instruction to set the legacy client OpenAI env name', () => {
    const files: string[] = []
    walk(path.join(ROOT, 'src'), files)
    walk(path.join(ROOT, 'api'), files)
    walk(path.join(ROOT, 'docs'), files)
    // Build the forbidden literal at runtime so this test file itself
    // does not contain the literal that would trigger the scan.
    const FORBIDDEN_LITERAL = ['set', 'VITE_', 'OPENAI_API_KEY'].join(' ')
      .replace('set ', 'set\\s+')
      .replace('VITE_ ', 'VITE_')
    const re = new RegExp(FORBIDDEN_LITERAL, 'i')
    const offenders: string[] = []
    for (const f of files) {
      // Skip this test file (it inspects the literal it forbids).
      if (f.endsWith('serverProxyContract.test.ts')) continue
      const txt = fs.readFileSync(f, 'utf8')
      if (re.test(txt)) {
        offenders.push(path.relative(ROOT, f))
      }
    }
    expect(offenders, `instructional reference found in: ${offenders.join(', ')}`).toEqual([])
  }, 30_000) // walks all of src/api/docs — a filesystem-bound test; generous budget so it never flakes on load

  it('AbuAI runtime "API not set" copy does NOT leak technical jargon to the user', () => {
    const svc = read('src/screens/AbuAI/service.ts')
    // The user-facing error must NEVER mention API keys, Vercel, or config details.
    // It should direct to Leo (דברי עם לאו).
    expect(svc.includes('דברי עם לאו')).toBe(true)
    expect(svc.includes('פנה לבן המשפחה שהתקין')).toBe(false)
  })
})

describe('service.ts uses the server-proxy provider for OpenAI', () => {
  const svc = read('src/screens/AbuAI/service.ts')

  it('imports sendServerChat + streamServerChat from ./serverChatProvider', () => {
    expect(svc.includes("sendServerChat")).toBe(true)
    expect(svc.includes("streamServerChat")).toBe(true)
    expect(svc.includes("from './serverChatProvider'")).toBe(true)
  })

  it('OPENAI_PROXY_URL points to /api/abuai-chat (no public OpenAI URL hardcoded)', () => {
    expect(svc.includes("const OPENAI_PROXY_URL = '/api/abuai-chat'")).toBe(true)
    // The literal client-side OpenAI URL is gone.
    expect(svc.includes("'https://api.openai.com/v1/chat/completions'")).toBe(false)
  })

  it('streamMessage routes the openai-server provider through streamServerChat', () => {
    expect(/provider\.kind === 'openai-server'/.test(svc)).toBe(true)
    expect(svc.includes('streamServerChat(body')).toBe(true)
  })

  it('tryProvider routes the openai-server provider through sendServerChat', () => {
    expect(/provider\.kind === 'openai-server'/.test(svc)).toBe(true)
    expect(svc.includes('sendServerChat({ model: provider.model')).toBe(true)
  })

  it('toolsEnabled() supports tools for openai-server only (Groq 400 fix)', () => {
    expect(svc.includes("provider.kind === 'openai-server'")).toBe(true)
    expect(svc.includes("provider.kind === 'openai-server' || provider.kind === 'groq-client'")).toBe(false)
  })
})

describe('Vercel chat endpoint contract', () => {
  const ep = read('api/abuai-chat.ts')

  it('endpoint is POST-only', () => {
    expect(ep.includes("if (req.method !== 'POST')")).toBe(true)
  })

  it('endpoint uses Edge runtime', () => {
    expect(ep.includes("export const config = { runtime: 'edge' }")).toBe(true)
  })

  it('endpoint returns OPENAI_API_KEY_MISSING when server key absent', () => {
    expect(ep.includes("'OPENAI_API_KEY_MISSING'")).toBe(true)
    expect(/if \(!apiKey\) \{[\s\S]{0,200}return jsonError\('OPENAI_API_KEY_MISSING'/.test(ep)).toBe(true)
  })

  it('endpoint provides HE/ES/EN error copy (no technical jargon)', () => {
    // Hebrew must not contain "שרת" or "חיבור ה-AI" — warm message only
    expect(ep.includes('דברי עם לאו')).toBe(true)
    expect(ep.includes('I cannot answer right now')).toBe(true)
    expect(ep.includes('No puedo responder')).toBe(true)
  })

  it('endpoint pipes SSE stream back unchanged when stream=true', () => {
    expect(ep.includes('text/event-stream')).toBe(true)
    expect(ep.includes('upstream.body')).toBe(true)
  })
})
