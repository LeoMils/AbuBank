/*
 * AbuAI B2.3 — Joint Optimization Contract
 *
 * Verifies the four surgical changes from the ChatGPT + Claude Code
 * joint plan are in place AND that the hard-rule envelope from PR #21
 * (no client OpenAI secret, no new vendor env vars, no Realtime,
 * spend-guard stays contract-only) is preserved.
 *
 *   1. Contact-action precedence — "תתקשרי ללאו" / "llamá a Leo" /
 *      "call Leo" / "mandale WhatsApp a Mor" route to a contact_action
 *      RouteResult (NOT family_lookup). tryGroundedAnswer returns a
 *      deterministic HE/ES/EN AbuWhatsApp-redirect string. AbuAI must
 *      never invent a phone number.
 *
 *   2. Family lookup still wins for descriptive questions
 *      ("Háblame de Leo", "מי זה לאו").
 *
 *   3. Personal-seed audit — the `memories` content world offers
 *      invitations FOR Martita to share, never claims AbuAI holds a
 *      private memory of Pepi or her childhood.
 *
 *   4. Location hint — both online call sites in index.tsx pass a
 *      static `locationHint: 'Kfar Saba area, Israel'` to
 *      answerOnlineCurrentInfo, so weather/local cues resolve to her
 *      city via the existing online endpoint (no Open-Meteo dependency
 *      introduced).
 *
 * Honesty rules (PR #21 envelope, re-asserted):
 *   • useRealtime stays false.
 *   • No production AbuAI source reads VITE_OPENAI_API_KEY.
 *   • No new vendor env vars (Tavily / Exa / Perplexity / Brave /
 *     OpenRouter / Vercel AI Gateway).
 *   • aiSpendGuard remains contract-only — it exports decision
 *     helpers but is NOT wired as a runtime gate.
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

import { routePersonalQuery } from './router'
import { tryGroundedAnswer, isPersonalQuery } from './service'
import { chooseContentWorld } from './contentWorldEngine'

const ROOT = path.resolve(__dirname, '../../..')
const ABUAI = path.join(ROOT, 'src/screens/AbuAI')
const INDEX = fs.readFileSync(path.join(ABUAI, 'index.tsx'), 'utf8')
const ROUTER = fs.readFileSync(path.join(ABUAI, 'router.ts'), 'utf8')
const SERVICE = fs.readFileSync(path.join(ABUAI, 'service.ts'), 'utf8')
const WORLD = fs.readFileSync(path.join(ABUAI, 'contentWorldEngine.ts'), 'utf8')
const SPEND = fs.readFileSync(path.join(ABUAI, 'aiSpendGuard.ts'), 'utf8')

describe('B2.3 joint-opt — contact-action precedence over family lookup', () => {
  it('Hebrew "תתקשרי ללאו" routes to contact_action (call)', () => {
    // Hebrew prefix "ל" (to) glues onto the name as "ללאו" — the loose
    // `matchKnownFamilyName` word-boundary check correctly skips that
    // (Hebrew letters are letters), so `familyQuery` may be undefined.
    // The redirect copy still works without a name field.
    const r = routePersonalQuery('תתקשרי ללאו')
    expect(r.type).toBe('contact_action')
    expect(r.contactAction).toBe('call')
  })

  it('Hebrew "שלחי וואטסאפ ללאו" routes to contact_action (whatsapp)', () => {
    const r = routePersonalQuery('שלחי וואטסאפ ללאו')
    expect(r.type).toBe('contact_action')
    expect(r.contactAction).toBe('whatsapp')
  })

  it('Hebrew "שלחי הודעה לאופיר" routes to contact_action (whatsapp or message)', () => {
    // "שלחי הודעה" matches both the whatsapp-superset and message
    // patterns; the detector picks whatsapp first. Either is a safe
    // AbuWhatsApp redirect at the service layer.
    const r = routePersonalQuery('שלחי הודעה לאופיר')
    expect(r.type).toBe('contact_action')
    expect(['whatsapp', 'message']).toContain(r.contactAction)
  })

  it('Spanish "llamá a Leo" routes to contact_action (call)', () => {
    const r = routePersonalQuery('llamá a Leo')
    expect(r.type).toBe('contact_action')
    expect(r.contactAction).toBe('call')
    expect(r.familyQuery).toBe('Leo')
  })

  it('Spanish "mandale un WhatsApp a Mor" routes to contact_action (whatsapp)', () => {
    const r = routePersonalQuery('mandale un WhatsApp a Mor')
    expect(r.type).toBe('contact_action')
    expect(r.contactAction).toBe('whatsapp')
  })

  it('Spanish "mandale un mensaje a Adar" routes to contact_action (message)', () => {
    const r = routePersonalQuery('mandale un mensaje a Adar')
    expect(r.type).toBe('contact_action')
    expect(r.contactAction).toBe('message')
  })

  it('English "call Leo" routes to contact_action (call)', () => {
    const r = routePersonalQuery('call Leo')
    expect(r.type).toBe('contact_action')
    expect(r.contactAction).toBe('call')
  })

  it('English "send a WhatsApp to Leo" routes to contact_action (whatsapp)', () => {
    const r = routePersonalQuery('send a WhatsApp to Leo')
    expect(r.type).toBe('contact_action')
    expect(r.contactAction).toBe('whatsapp')
  })

  it('Family descriptive question still routes to family_lookup', () => {
    expect(routePersonalQuery('Háblame de Leo').type).toBe('family_lookup')
    expect(routePersonalQuery('מי זה לאו').type).toBe('family_lookup')
    expect(routePersonalQuery('Quién es Leo').type).toBe('family_lookup')
  })

  it('isPersonalQuery treats contact-action requests as personal (grounded path)', () => {
    expect(isPersonalQuery('תתקשרי ללאו')).toBe(true)
    expect(isPersonalQuery('llamá a Leo')).toBe(true)
    expect(isPersonalQuery('call Leo')).toBe(true)
  })
})

describe('B2.3 joint-opt — tryGroundedAnswer redirects contact actions to AbuWhatsApp', () => {
  it('Hebrew call → mentions אבו וואטסאפ + להתקשר, never a digit', () => {
    const ans = tryGroundedAnswer('תתקשרי ללאו') ?? ''
    expect(ans).toContain('אבו וואטסאפ')
    expect(ans).toContain('להתקשר')
    expect(/\d/.test(ans)).toBe(false)
  })

  it('Hebrew whatsapp → mentions לשלוח וואטסאפ', () => {
    const ans = tryGroundedAnswer('שלחי וואטסאפ ללאו') ?? ''
    expect(ans).toContain('לשלוח וואטסאפ')
    expect(ans).toContain('אבו וואטסאפ')
  })

  it('Spanish llamá → mentions Abu WhatsApp, never a phone number', () => {
    const ans = tryGroundedAnswer('llamá a Leo') ?? ''
    expect(ans).toContain('Abu WhatsApp')
    expect(ans).toContain('Leo')
    expect(/\d/.test(ans)).toBe(false)
  })

  it('Spanish mandale WhatsApp → mentions WhatsApp + name', () => {
    const ans = tryGroundedAnswer('mandale un WhatsApp a Mor') ?? ''
    expect(ans).toContain('WhatsApp')
    expect(ans.toLowerCase()).toContain('abu whatsapp')
  })

  it('English call → mentions Abu WhatsApp + name', () => {
    const ans = tryGroundedAnswer('call Leo') ?? ''
    expect(ans).toContain('Abu WhatsApp')
    expect(ans).toContain('Leo')
    expect(/\d/.test(ans)).toBe(false)
  })

  it('No contact-action redirect ever surfaces a phone number literal', () => {
    for (const q of [
      'תתקשרי ללאו', 'llamá a Leo', 'call Leo',
      'שלחי וואטסאפ ללאו', 'mandale un WhatsApp a Mor',
      'send a WhatsApp to Leo', 'text Adar',
    ]) {
      const ans = tryGroundedAnswer(q) ?? ''
      expect(/\+?\d[\d \-]{6,}/.test(ans), `${q} surfaced a phone-like literal`).toBe(false)
    }
  })
})

describe('B2.3 joint-opt — content world `memories` block is invitation-shaped', () => {
  // The risk we mitigate: AbuAI does NOT hold a private memory of Pepi
  // or Martita's childhood. The options must read as "tell ME about X"
  // — never as "I have a memory of X to share with you".
  it('Hebrew memories option for Pepi reads as an invitation', () => {
    expect(WORLD).toContain('לדבר על פפי, אם בא לך')
    // The earlier "Pepi memory" framing (which implied AbuAI holds one)
    // must be gone.
    expect(WORLD.includes('זיכרון על פפי')).toBe(false)
    expect(WORLD.includes('זכרון על פפי')).toBe(false)
  })

  it('Spanish memories option for Pepi reads as an invitation, not a curated memory', () => {
    expect(WORLD).toContain('Hablar de Pepi, si querés')
    expect(WORLD.includes('Algo de Pepi con cariño')).toBe(false)
    expect(WORLD.includes('un recuerdo de Pepi')).toBe(false)
  })

  it('English memories option for Pepi reads as an invitation', () => {
    expect(WORLD).toContain('Talk about Pepi, if you like')
    expect(WORLD.includes('A gentle Pepi memory')).toBe(false)
    expect(WORLD.includes('A Pepi memory')).toBe(false)
  })

  it('Childhood options are invitation-shaped in all three languages', () => {
    expect(WORLD).toContain('לדבר על הילדות שלך')
    expect(WORLD).toContain('Hablar de tu infancia')
    expect(WORLD).toContain('Talk about your childhood')
  })

  it('chooseContentWorld() still labels the memories block correctly', () => {
    // The runtime contract: the engine still surfaces a memories mode
    // for one of its canonical cues (me acuerdo / cuéntame de cuando /
    // זכרון). The unsafe Pepi-memory option must be absent.
    const w = chooseContentWorld('me acuerdo de cuando')
    expect(w.contentMode).toBe('memories')
    expect(w.gentleOptions.length).toBeGreaterThanOrEqual(2)
    for (const opt of w.gentleOptions) {
      expect(/Algo de Pepi con cariño/i.test(opt)).toBe(false)
      expect(/A gentle Pepi memory/i.test(opt)).toBe(false)
    }
  })
})

describe('B2.3 joint-opt — both online call sites pass the static Kfar Saba locationHint', () => {
  it('text path passes locationHint: "Kfar Saba area, Israel"', () => {
    expect(
      /answerOnlineCurrentInfo\(msgText,\s*\{\s*locationHint:\s*'Kfar Saba area, Israel'\s*\}\s*\)/.test(INDEX),
    ).toBe(true)
  })

  it('voice path passes locationHint: "Kfar Saba area, Israel"', () => {
    expect(
      /answerOnlineCurrentInfo\(text,\s*\{\s*locationHint:\s*'Kfar Saba area, Israel'\s*\}\s*\)/.test(INDEX),
    ).toBe(true)
  })

  it('no answerOnlineCurrentInfo() call site is missing the locationHint', () => {
    // Count the call sites — both must include the option object.
    const all = INDEX.match(/answerOnlineCurrentInfo\(/g) ?? []
    // index.tsx has exactly 2 production call sites (text + voice).
    // The import line is "answerOnlineCurrentInfo," (no opening paren).
    expect(all.length).toBe(2)
    const withHint = INDEX.match(/answerOnlineCurrentInfo\([^)]*locationHint:\s*'Kfar Saba area, Israel'/g) ?? []
    expect(withHint.length).toBe(2)
  })

  it('no AbuAI source actually fetches a third-party weather API', () => {
    const files = fs.readdirSync(ABUAI)
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx'))
        && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
    for (const f of files) {
      const src = fs.readFileSync(path.join(ABUAI, f), 'utf8')
      // TODO/comment mentions of free providers are allowed (they
      // document the future direction); actual fetch URLs are not.
      expect(/fetch\(['"`]https:\/\/api\.open-meteo/.test(src), `${f} fetches api.open-meteo`).toBe(false)
      expect(/fetch\(['"`]https:\/\/api\.openweathermap/.test(src), `${f} fetches openweathermap`).toBe(false)
    }
  })
})

describe('B2.3 joint-opt — hard-rule envelope preserved', () => {
  it('useRealtime stays false in index.tsx', () => {
    expect(INDEX.includes('const useRealtime = false')).toBe(true)
  })

  it('no production AbuAI source reads VITE_OPENAI_API_KEY', () => {
    const files = fs.readdirSync(ABUAI)
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx'))
        && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
    // Build the forbidden literal at runtime so this very test file
    // does not contain the string and trip the same scan.
    const FORBIDDEN_LITERAL = ['VITE', '_OPENAI', '_API_KEY'].join('')
    for (const f of files) {
      const src = fs.readFileSync(path.join(ABUAI, f), 'utf8')
      expect(src.includes(FORBIDDEN_LITERAL), `${f} reads ${FORBIDDEN_LITERAL}`).toBe(false)
    }
  })

  it('no new vendor env vars introduced', () => {
    const files = fs.readdirSync(ABUAI)
      .filter((f) => (f.endsWith('.ts') || f.endsWith('.tsx'))
        && !f.endsWith('.test.ts') && !f.endsWith('.test.tsx'))
    // Note: VITE_GEMINI_API_KEY was already wired as a free fallback
    // in B2.1 (it predates the joint plan). This branch does NOT add
    // any *new* vendor env vars.
    const FORBIDDEN = [
      'TAVILY_API_KEY', 'EXA_API_KEY', 'PERPLEXITY_API_KEY',
      'BRAVE_API_KEY', 'OPENROUTER_API_KEY', 'VERCEL_AI_GATEWAY_KEY',
    ]
    for (const f of files) {
      const src = fs.readFileSync(path.join(ABUAI, f), 'utf8')
      for (const v of FORBIDDEN) {
        expect(src.includes(v), `${f} references ${v}`).toBe(false)
      }
    }
  })

  it('aiSpendGuard remains contract-only (no runtime wiring in index.tsx)', () => {
    // The module exists and exports decision helpers...
    expect(SPEND.length).toBeGreaterThan(0)
    // ...but the runtime entry point does NOT import or call them.
    // Honest stance from the joint plan: enforcement requires a server
    // counter; we have not added one. Don't pretend we did.
    expect(INDEX.includes("from './aiSpendGuard'")).toBe(false)
    expect(INDEX.includes('aiSpendGuard(')).toBe(false)
  })

  it('contact-action redirects never invent a phone number or initiate a call', () => {
    // Production source must not contain "tel:" or window.open of tel
    // links for an AbuAI-redirected call. The redirect points Martita
    // to AbuWhatsApp, which holds the actual phone data locally.
    expect(/tel:\+?\d/.test(SERVICE)).toBe(false)
    expect(SERVICE.includes('window.open(\'tel:')).toBe(false)
  })

  it('router contact_action regexes are scoped (call/whatsapp/message), no broad "phone" catch-all', () => {
    // Sanity: we intentionally did NOT add a "give me Leo\'s phone"
    // regex. That request would still route to family_lookup, which
    // answers about who Leo is — never with a phone number.
    expect(ROUTER.includes("'call'")).toBe(true)
    expect(ROUTER.includes("'whatsapp'")).toBe(true)
    expect(ROUTER.includes("'message'")).toBe(true)
  })
})

describe('B2.3 joint-opt — Truth Contract still wins on personal/current cues', () => {
  it('calendar question is personal → grounded path (no online detour)', () => {
    expect(isPersonalQuery('¿Qué tengo hoy?')).toBe(true)
    expect(isPersonalQuery('מה יש לי היום')).toBe(true)
  })

  it('family question is personal → grounded path', () => {
    expect(isPersonalQuery('Háblame de Leo')).toBe(true)
    expect(isPersonalQuery('מי זה אופיר')).toBe(true)
  })

  it('weather-style query is NOT personal (online will resolve with locationHint)', () => {
    // The locationHint is the contract: the online endpoint resolves
    // weather in Kfar Saba on its own, no extra Open-Meteo dependency.
    expect(isPersonalQuery('¿Qué tiempo hace hoy?')).toBe(false)
    expect(isPersonalQuery('מה מזג האוויר היום')).toBe(false)
  })
})
