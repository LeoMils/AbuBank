/*
 * rc-acceptance-whatsapp.mjs — WhatsApp compose + fact-preservation + SAFE send boundary. (§16)
 * ════════════════════════════════════════════════════════════════════════════════════════════
 *   npx tsx scripts/rc-acceptance-whatsapp.mjs <rcUrl>
 *
 * Three machine-closable claims, using the REAL capability code (no re-implementation):
 *  1. DEPLOYED COMPOSE — the exact buildComposePrompt() messages are POSTed to the deployed
 *     <rc>/api/abuai-chat (OpenAI gpt-4o, server-only key). Proves the deployed compose path runs.
 *  2. FACT-PRESERVING — the real verifyDraft() must confirm every fact token from the intent
 *     (here the time "19:00") survived into the draft. This MIRRORS composeWhatsAppMessageDetailed:
 *     server draft is accepted ONLY if verifyDraft.ok, else the real fact-preserving localCompose()
 *     fallback is used. Final message is always fact-preserving — the capability's contract.
 *     A sensitivity control proves verifyDraft actually CATCHES a dropped fact (not vacuously green).
 *  3. SAFE SEND BOUNDARY — the real buildWhatsAppPersonUrl() is exercised with a MOCK phone (never a
 *     real contact). It must yield a wa.me PRE-FILL deep link (?text=<draft>), never an auto-send.
 *     No unintended real message can be sent: this script contacts ONLY the RC origin — never any
 *     wa.me / *.whatsapp.com host (asserted). WhatsApp always requires a manual send tap.
 * Writes docs/eval/RC_ACCEPTANCE_WHATSAPP.json and exits non-zero on any FAIL.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import './lib/hydrate-family-node.ts' // family_data.json is no longer bundled — hydrate for this node script
import { verifyDraft, buildComposePrompt, localCompose } from '../src/screens/AbuAI/whatsappCompose.ts'
import { buildWhatsAppPersonUrl } from '../src/screens/AbuWhatsApp/familyQuickFaces.tsx'
import { installNodeFetchAuth } from './lib/acceptance-session.mjs'

const RC = (process.argv[2] || '').replace(/\/$/, '')
installNodeFetchAuth() // CI session header for the now-authenticated billable endpoints
if (!RC) { console.error('usage: npx tsx scripts/rc-acceptance-whatsapp.mjs <rcUrl>'); process.exit(2) }

const steps = []
const rec = (id, pass, detail) => { steps.push({ id, pass: !!pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id.padEnd(24)} ${detail ?? ''}`) }
const hostsTouched = new Set()

// The compose command — an INVITATION carrying an explicit fact (the time 19:00) that MUST survive.
const FACT = '19:00'
const cmd = {
  targetName: 'לאדר', targetHebrew: 'אדר',
  intent: `ארוחת שישי בשעה ${FACT} אצל סבתא`,
  style: 'normal', source: 'text', wantsReview: false,
  plan: { purpose: 'invitation', facts: `ארוחת שישי בשעה ${FACT}`, requestedTone: 'normal', language: 'he', constraints: ['keep-time'], referencesPriorTurn: false },
}

async function deployedCompose() {
  const { system, user } = buildComposePrompt(cmd)
  const url = `${RC}/api/abuai-chat`
  hostsTouched.add(new URL(url).host)
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: { model: 'gpt-4o', messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 1.0, max_tokens: 400 }, lang: 'he', stream: false }),
  })
  const j = await res.json().catch(() => ({}))
  const content = j?.openai?.choices?.[0]?.message?.content
  return { ok: !!j?.ok && typeof content === 'string' && content.trim().length > 0, http: res.status, message: (content || '').trim(), errorCode: j?.errorCode }
}

async function main() {
  console.log(`=== RC WHATSAPP ACCEPTANCE · ${RC} ===\n`)
  let finalMessage = ''
  let composePath = 'local-fallback'

  try {
    // ── 1) DEPLOYED COMPOSE ────────────────────────────────────────────────
    const server = await deployedCompose()
    rec('compose.deployed', server.ok, server.ok ? `gpt-4o via proxy · ${server.message.length} chars` : `HTTP ${server.http} ${server.errorCode ?? ''}`)

    // ── 2) FACT-PRESERVING (mirror the capability: server if verifyDraft.ok, else local fallback) ──
    let verdict
    if (server.ok) {
      verdict = verifyDraft(cmd, server.message)
      if (verdict.ok) { finalMessage = server.message; composePath = 'openai-server' }
    }
    if (!finalMessage) { finalMessage = localCompose(cmd); composePath = 'local-fallback'; verdict = verifyDraft(cmd, finalMessage) }
    rec('compose.factPreserved', verdict.ok && !verdict.missingFacts.includes(FACT),
      `path=${composePath} · "${FACT}" survived=${finalMessage.includes(FACT)} · missing=[${verdict.missingFacts.join(',')}]`)

    // QA-of-QA: verifyDraft must FAIL a draft that drops the fact (specificity — not vacuously green).
    const dropped = verifyDraft(cmd, 'אדר יקר בואו לארוחה. אבו')  // no time
    rec('factCheck.sensitivity', dropped.ok === false && dropped.missingFacts.includes(FACT),
      `dropped-fact draft → ok=${dropped.ok} missing=[${dropped.missingFacts.join(',')}]`)

    // ── 3) SAFE SEND BOUNDARY (real fn, MOCK phone, zero real send) ─────────
    const MOCK_PHONE = '+100000000000'  // reserved test number — never a real contact
    const handoff = buildWhatsAppPersonUrl({ type: 'person', enabled: true, id: 'mock', name: 'MOCK', phoneE164: MOCK_PHONE }, finalMessage)
    const u = new URL(handoff)
    const prefill = decodeURIComponent(u.searchParams.get('text') || '')
    const isPrefill = u.host === 'wa.me' && u.pathname === '/100000000000' && prefill === finalMessage
    const noAutoSend = !/[?&](send|auto|type)=/i.test(handoff)  // prefill deep link only, never an auto-send API
    rec('send.prefillOnly', isPrefill && noAutoSend, `${u.host}${u.pathname}?text=… draft-encoded=${prefill === finalMessage} autoSend=${!noAutoSend}`)

    // No unintended real send: the ONLY host this script ever contacted is the RC — never wa.me/whatsapp.
    const contactedWhatsApp = [...hostsTouched].some((h) => /wa\.me|whatsapp\.com/i.test(h))
    rec('send.noRealSend', !contactedWhatsApp && hostsTouched.size >= 1, `hosts contacted: [${[...hostsTouched].join(', ')}] (mock recipient, no send tap performed)`)
  } catch (e) {
    rec('harness', false, `threw: ${String(e?.message || e).slice(0, 200)}`)
  }

  const passed = steps.filter((s) => s.pass).length
  const allPass = steps.length > 0 && passed === steps.length
  const summary = {
    $schema: 'internal://abu/rc-acceptance-whatsapp',
    rc: RC, when: new Date().toISOString(),
    intent: cmd.intent, requiredFact: FACT, composePath, finalMessage,
    verdict: allPass ? 'PROVEN_PASS' : 'PROVEN_FAIL',
    evidence: { 'compose.deployed': 'PREVIEW (deployed proxy + gpt-4o)', factPreservation: 'CODE (real verifyDraft)', sendBoundary: 'CODE (real buildWhatsAppPersonUrl, mock phone, no send)' },
    passed, total: steps.length, steps,
  }
  writeFileSync(resolve('docs/eval/RC_ACCEPTANCE_WHATSAPP.json'), JSON.stringify(summary, null, 2) + '\n')
  console.log(`\nfinal draft (${composePath}):\n  ${finalMessage.replace(/\n/g, '\n  ')}`)
  console.log(`\n=== ${summary.verdict}  ${passed}/${steps.length} ===`)
  console.log('wrote docs/eval/RC_ACCEPTANCE_WHATSAPP.json')
  process.exit(allPass ? 0 : 1)
}
main().catch((e) => { console.error('whatsapp acceptance error:', e?.message || e); process.exit(1) })
