import { describe, it, expect } from 'vitest'
import {
  understandWhatsAppCommand,
  matchTargetName,
  isComposeCommand,
  isFollowUpCorrection,
  applyFollowUp,
  extractMessagePlan,
  buildComposePrompt,
  localCompose,
  applyAbuStyle,
  verifyDraft,
  STYLE_BLOCKS,
  STYLE_LABEL_HE,
  type WhatsAppStyle,
  type WhatsAppComposeCommand,
} from './whatsappCompose'

// ── Test helper: build a full command without the network ──
function cmd(partial: { targetHebrew?: string; intent: string; style: WhatsAppStyle }): WhatsAppComposeCommand {
  const base = understandWhatsAppCommand(
    `${partial.targetHebrew ? 'ל' + partial.targetHebrew + ' ' : ''}${partial.intent}`,
  )
  return { ...base, style: partial.style, plan: { ...base.plan, requestedTone: partial.style } }
}

// ════════════════════════════════════════════════════════════════════════════
// CommunicationIntentResolver — is this a compose command at all?
// ════════════════════════════════════════════════════════════════════════════
describe('isComposeCommand — intent routing', () => {
  it('recognises natural compose commands (HE)', () => {
    expect(isComposeCommand('תכתבי לירדן שאני מאחר בעשר דקות')).toBe(true)
    expect(isComposeCommand('שלחי לאדר מזל טוב')).toBe(true)
    expect(isComposeCommand('תכתבי לאופיר בסגנון אבו שתביא חלב')).toBe(true)
  })
  it('does NOT treat a pure call request as compose', () => {
    expect(isComposeCommand('תתקשרי לאדר')).toBe(false)
    expect(isComposeCommand('llamá a Leo')).toBe(false)
  })
  it('does NOT treat an info question mentioning whatsapp as compose', () => {
    expect(isComposeCommand('מה זה וואטסאפ')).toBe(false)
    expect(isComposeCommand('כמה הודעות יש לי')).toBe(false)
  })
  it('recognises Spanish/English compose', () => {
    expect(isComposeCommand('mandale un mensaje a Mor que llego tarde')).toBe(true)
    expect(isComposeCommand('send a message to Adar that I am late')).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// understandWhatsAppCommand — target + intent + style + plan
// ════════════════════════════════════════════════════════════════════════════
describe('understandWhatsAppCommand', () => {
  it('parses recipient, intent (facts) and style from a natural command', () => {
    const c = understandWhatsAppCommand('תכתבי לירדן שאני מאחר בעשר דקות')
    expect(c.targetHebrew).toBe('ירדן')
    expect(c.style).toBe('normal')
    expect(c.intent).toContain('מאחר')
    expect(c.intent).toContain('עשר דקות')
    expect(c.intent).not.toMatch(/תכתבי|לירדן/)
    expect(c.plan.purpose).toBe('apology')
    expect(c.plan.constraints).toContain('keep-number')
  })

  it('detects funny style and keeps the fact ("בערב")', () => {
    const c = understandWhatsAppCommand('תכתבי לאיליי הודעה מצחיקה שאני מגיע בערב')
    expect(c.style).toBe('funny')
    expect(c.intent).toContain('בערב')
    expect(c.intent).not.toMatch(/מצחיק/)
  })

  it('detects Abu style', () => {
    const c = understandWhatsAppCommand('תכתבי לאופיר בסגנון אבו שתביא חלב')
    expect(c.targetHebrew).toBe('אופיר')
    expect(c.style).toBe('abu')
    expect(c.intent).toContain('חלב')
    expect(c.plan.purpose).toBe('request')
  })

  it('defaults style to normal and marks source', () => {
    const c = understandWhatsAppCommand('תכתבי למור שאני אוהבת אותה', { source: 'voice' })
    expect(c.style).toBe('normal')
    expect(c.source).toBe('voice')
    expect(c.targetHebrew).toBe('מור')
  })

  it('carries no recipient when none is named', () => {
    const c = understandWhatsAppCommand('מזל טוב ליום הולדת')
    expect(c.targetHebrew).toBeNull()
    expect(c.targetName).toBeNull() // "ליום" must NOT be mistaken for a recipient
    expect(c.intent).toContain('מזל טוב')
  })

  it('captures a fuzzy candidate recipient (STT misspelling) as targetName', () => {
    const c = understandWhatsAppCommand('תכתבי לאדד שלום')
    expect(c.targetHebrew).toBeNull()   // not an exact family name
    expect(c.targetName).toBe('אדד')    // candidate slot captured for fuzzy resolve
    expect(c.intent).toContain('שלום')
    expect(c.intent).not.toContain('אדד')
  })

  it('flags a time constraint from digits and from hour-words', () => {
    expect(understandWhatsAppCommand('תכתבי לירדן שאני מגיע ב-8').plan.constraints).toContain('keep-time')
    expect(understandWhatsAppCommand('תכתבי לירדן שאני מגיע בשבע').plan.constraints).toContain('keep-time')
  })
})

describe('matchTargetName', () => {
  it('matches a prefixed Hebrew name and an alias', () => {
    expect(matchTargetName('שלחי לאדר משהו')?.hebrew).toBe('אדר')
    expect(matchTargetName('שלחי למורי משהו')?.hebrew).toBe('מור')
  })
  it('returns null for a non-name sentence', () => {
    expect(matchTargetName('מה השעה עכשיו')).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// MessagePlanExtractor
// ════════════════════════════════════════════════════════════════════════════
describe('extractMessagePlan', () => {
  it('classifies purpose and language', () => {
    expect(extractMessagePlan('שתביא חלב', 'normal', 'תכתבי לאופיר שתביא חלב').purpose).toBe('request')
    expect(extractMessagePlan('feliz cumpleaños', 'normal', 'mandale feliz cumpleaños').language).toBe('es')
  })
  it('captures keep-url and keep-time constraints', () => {
    const p = extractMessagePlan('תראה את זה https://a.co ב-9', 'normal', 'x')
    expect(p.constraints).toContain('keep-url')
    expect(p.constraints).toContain('keep-time')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// DraftConversationState — corrections & follow-ups
// ════════════════════════════════════════════════════════════════════════════
describe('isFollowUpCorrection', () => {
  it('treats time/style edits as follow-ups, not new commands', () => {
    expect(isFollowUpCorrection('לא, בשמונה')).toBe(true)
    expect(isFollowUpCorrection('תעשי את זה מצחיק')).toBe(true)
    expect(isFollowUpCorrection('בשמונה')).toBe(true)
  })
  it('treats a fresh "to X" command as NOT a follow-up', () => {
    expect(isFollowUpCorrection('תכתבי לאדר שלום')).toBe(false)
  })
})

describe('applyFollowUp — updates the draft plan, not a new task', () => {
  it('swaps the time and adds style while keeping the recipient', () => {
    const first = understandWhatsAppCommand('תכתבי לירדן שאני מגיע בשבע')
    const updated = applyFollowUp(first, 'לא, בשמונה, ותעשי את זה מצחיק')
    expect(updated.targetHebrew).toBe('ירדן')     // recipient preserved
    expect(updated.style).toBe('funny')            // style updated
    expect(updated.intent).toContain('שמונה')      // time corrected
    expect(updated.intent).not.toContain('שבע')    // old time gone
    expect(updated.plan.referencesPriorTurn).toBe(true)
  })
  it('changes the recipient when a new name is named', () => {
    const first = understandWhatsAppCommand('תכתבי לירדן שאני מגיע בשבע')
    const updated = applyFollowUp(first, 'לא, לאדר')
    expect(updated.targetHebrew).toBe('אדר')
  })
  it('appends added detail when there is no time to swap', () => {
    const first = understandWhatsAppCommand('תכתבי לאדר שאני אוהב אותו')
    const updated = applyFollowUp(first, 'ותוסיפי שאני גאה בו')
    expect(updated.intent).toContain('אוהב')
    expect(updated.intent).toContain('גאה')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Shared Abu-style transform (fact-safe)
// ════════════════════════════════════════════════════════════════════════════
describe('applyAbuStyle — recognisable mistakes without corrupting facts', () => {
  it('applies the signature מאחל→מאכל mistake', () => {
    expect(applyAbuStyle('אני מאחלת לך')).toContain('מאכלת')
  })
  it('preserves numbers, times, links and the recipient name', () => {
    const out = applyAbuStyle('אדר אני מגיע ב 8:30 תראה https://a.co', ['אדר'])
    expect(out).toContain('8:30')
    expect(out).toContain('https://a.co')
    expect(out).toContain('אדר')
  })
  it('always ends with emphasis', () => {
    expect(applyAbuStyle('שלום').endsWith('!!!!')).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// MessageComposer (local) + prompt wiring
// ════════════════════════════════════════════════════════════════════════════
describe('localCompose — deterministic, fact-preserving fallback', () => {
  it('is non-empty and preserves numeric facts across all styles', () => {
    for (const style of ['normal', 'funny', 'abu'] as WhatsAppStyle[]) {
      const c = understandWhatsAppCommand('תכתבי לאדר שאני מגיע ב-8')
      const msg = localCompose({ ...c, style }, { recipientLabel: 'אדר' })
      expect(msg.length).toBeGreaterThan(0)
      expect(msg).toContain('8')          // number survives the style transform
      expect(msg).toContain('אדר')        // recipient survives
    }
  })
})

describe('buildComposePrompt — style + recipient wiring', () => {
  it('abu style injects the mandatory-mistakes block; normal does not', () => {
    const abu = buildComposePrompt(cmd({ targetHebrew: 'אדר', intent: 'מזל טוב', style: 'abu' }))
    expect(abu.system).toContain('מאכלת')
    expect(abu.system).toContain(STYLE_BLOCKS.abu)
    const normal = buildComposePrompt(cmd({ targetHebrew: 'אדר', intent: 'מזל טוב', style: 'normal' }))
    expect(normal.system).not.toContain('מאכלת')
  })
  it('addresses the recipient and carries the topic', () => {
    const { user } = buildComposePrompt(cmd({ targetHebrew: 'אדר', intent: 'מזל טוב', style: 'normal' }))
    expect(user).toContain('אל אדר')
    expect(user).toContain('מזל טוב')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// DraftVerifier
// ════════════════════════════════════════════════════════════════════════════
describe('verifyDraft', () => {
  it('passes when facts are retained', () => {
    const c = understandWhatsAppCommand('תכתבי לאדר שאני מגיע ב-8')
    expect(verifyDraft(c, 'אדר, אני מגיע ב-8 ❤️').ok).toBe(true)
  })
  it('fails when a required number is dropped', () => {
    const c = understandWhatsAppCommand('תכתבי לאדר שאני מגיע ב-8')
    const v = verifyDraft(c, 'אדר, אני מגיע אחר כך')
    expect(v.ok).toBe(false)
    expect(v.issues).toContain('fact_lost')
    expect(v.missingFacts).toContain('8')
  })
  it('fails on an empty draft', () => {
    const c = understandWhatsAppCommand('תכתבי לאדר שלום')
    expect(verifyDraft(c, '   ').ok).toBe(false)
  })
})

describe('style labels', () => {
  it('exposes Hebrew labels for all three styles', () => {
    const styles: WhatsAppStyle[] = ['normal', 'funny', 'abu']
    for (const s of styles) expect(STYLE_LABEL_HE[s]).toBeTruthy()
    expect(STYLE_LABEL_HE.abu).toBe('אבו')
  })
})
