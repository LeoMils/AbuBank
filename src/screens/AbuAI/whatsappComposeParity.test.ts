import { describe, it, expect, beforeEach } from 'vitest'
import { understandWhatsAppCommand } from './whatsappCompose'
import {
  recordComposeEvent,
  getRecentComposeEvents,
  clearComposeEvents,
  mechanismForCorrection,
} from './whatsappComposeTelemetry'

// ════════════════════════════════════════════════════════════════════════════
// Modality parity — voice and text reach the SAME understanding/capability path
// ════════════════════════════════════════════════════════════════════════════
describe('voice/text parity', () => {
  const utterances = [
    'תכתבי לירדן שאני מאחר בעשר דקות',
    'תכתבי לאיליי הודעה מצחיקה שאני מגיע בערב',
    'תכתבי לאופיר בסגנון אבו שתביא חלב',
  ]
  it('produces equivalent recipient, intent, style and plan regardless of source', () => {
    for (const u of utterances) {
      const v = understandWhatsAppCommand(u, { source: 'voice' })
      const t = understandWhatsAppCommand(u, { source: 'text' })
      expect(v.targetHebrew).toBe(t.targetHebrew)
      expect(v.intent).toBe(t.intent)
      expect(v.style).toBe(t.style)
      expect(v.plan).toEqual(t.plan)
      // Only the source tag differs.
      expect(v.source).toBe('voice')
      expect(t.source).toBe('text')
    }
  })
})

// ════════════════════════════════════════════════════════════════════════════
// Telemetry — privacy-safe, bounded, mechanism-classified
// ════════════════════════════════════════════════════════════════════════════
describe('compose telemetry', () => {
  beforeEach(() => clearComposeEvents())

  it('drops a phone-number-looking recipient (privacy)', () => {
    recordComposeEvent({ type: 'recipient_resolved', recipient: '+972501234567' })
    expect(getRecentComposeEvents()[0]?.recipient).toBeNull()
  })

  it('truncates long free text to a short preview', () => {
    recordComposeEvent({ type: 'request', requestPreview: 'א'.repeat(200) })
    const p = getRecentComposeEvents()[0]?.requestPreview ?? ''
    expect(p.length).toBeLessThanOrEqual(61)
  })

  it('keeps a bounded ring (never grows without limit)', () => {
    for (let i = 0; i < 120; i++) recordComposeEvent({ type: 'request', requestPreview: `x${i}` })
    expect(getRecentComposeEvents().length).toBeLessThanOrEqual(50)
  })

  it('maps corrected fields to generalized mechanism classes', () => {
    expect(mechanismForCorrection('recipient')).toBe('recipient_entity_resolution')
    expect(mechanismForCorrection('time')).toBe('message_plan_fact_retention')
    expect(mechanismForCorrection('style')).toBe('style_transformation_semantic_loss')
    expect(mechanismForCorrection('modality')).toBe('modality_runtime_divergence')
  })
})
