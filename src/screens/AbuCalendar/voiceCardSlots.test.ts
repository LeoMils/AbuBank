import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { formatHebrewDateSlot } from './VoiceCard'

const SOURCE = readFileSync(resolve(__dirname, './VoiceCard.tsx'), 'utf8')
const INDEX_SOURCE = readFileSync(resolve(__dirname, './index.tsx'), 'utf8')

describe('VoiceCard — JUL 17 calendar icon removal', () => {
  it('does not render the emoji as a top-of-card decoration', () => {
    expect(SOURCE).not.toMatch(/<span[^>]*>\{emoji\}<\/span>/)
    expect(SOURCE).not.toMatch(/>\s*📅\s*</)
  })

  it('the only mention of 📅 is the sentinel that rejects the calendar fallback', () => {
    const occurrences = SOURCE.match(/📅/g) ?? []
    expect(occurrences).toHaveLength(1)
    expect(SOURCE).toContain("parsed.emoji !== '📅'")
  })

  it('does not render any static date image/icon', () => {
    expect(SOURCE).not.toMatch(/JUL/i)
    expect(SOURCE).not.toMatch(/calendar\.(png|jpg|svg)/i)
  })
})

describe('VoiceCard — transcript review', () => {
  it('shows the raw transcript in a clearly labeled box', () => {
    expect(SOURCE).toContain('data-testid="transcript-box"')
    expect(SOURCE).toContain('data-testid="transcript-textarea"')
    expect(SOURCE).toMatch(/>\s*מה שמעתי\s*</)
  })

  it('renders a "נתחי שוב" reparse button wired to onReparse', () => {
    expect(SOURCE).toContain('data-testid="reparse-button"')
    expect(SOURCE).toMatch(/>נתחי שוב</)
    expect(SOURCE).toMatch(/onClick=\{\(\)\s*=>\s*onReparse\(transcriptDraft\)\}/)
  })

  it('parent screen wires the reparse handler', () => {
    expect(INDEX_SOURCE).toContain('handleReparse')
    expect(INDEX_SOURCE).toMatch(/onReparse=\{handleReparse\}/)
    expect(INDEX_SOURCE).toContain('parseAppointmentText(transcript)')
  })
})

describe('VoiceCard — editable fields', () => {
  it('renders all five fields: מה / תאריך / שעה / איפה / הערה', () => {
    expect(SOURCE).toContain('data-testid="field-what"')
    expect(SOURCE).toContain('data-testid="field-date"')
    expect(SOURCE).toContain('data-testid="field-time"')
    expect(SOURCE).toContain('data-testid="field-where"')
    expect(SOURCE).toContain('data-testid="field-note"')
    expect(SOURCE).toMatch(/>\s*מה\s*</)
    expect(SOURCE).toMatch(/>\s*תאריך\s*</)
    expect(SOURCE).toMatch(/>\s*שעה\s*</)
    expect(SOURCE).toMatch(/>\s*איפה\s*</)
    expect(SOURCE).toMatch(/>\s*הערה\s*</)
  })

  it('every field is an editable input/textarea, not read-only text', () => {
    expect(SOURCE).toMatch(/onChange=\{e\s*=>\s*setTitle/)
    expect(SOURCE).toMatch(/onChange=\{e\s*=>\s*setDate/)
    expect(SOURCE).toMatch(/onChange=\{e\s*=>\s*setTime/)
    expect(SOURCE).toMatch(/onChange=\{e\s*=>\s*setLocation/)
    expect(SOURCE).toMatch(/onChange=\{e\s*=>\s*setNotes/)
  })

  it('missing fields show "חסר" placeholder', () => {
    expect(SOURCE).toContain('placeholder="חסר"')
  })

  it('does not use the iOS-broken native pickers', () => {
    expect(SOURCE).not.toMatch(/type="date"/)
    expect(SOURCE).not.toMatch(/type="time"/)
  })
})

describe('VoiceCard — recording state machine', () => {
  it('renders a state badge', () => {
    expect(SOURCE).toContain('data-testid="voice-state-badge"')
  })

  it('exports the state union', () => {
    expect(SOURCE).toContain('export type VoiceState')
    for (const s of ['idle', 'recording', 'transcribing', 'parsing', 'parsed', 'error']) {
      expect(SOURCE).toContain(`'${s}'`)
    }
  })

  it('parent transitions through recording → transcribing → parsing → parsed', () => {
    expect(INDEX_SOURCE).toMatch(/setVoiceState\(['"]recording['"]\)/)
    expect(INDEX_SOURCE).toMatch(/setVoiceState\(['"]transcribing['"]\)/)
    expect(INDEX_SOURCE).toMatch(/setVoiceState\(['"]parsing['"]\)/)
    expect(INDEX_SOURCE).toMatch(/setVoiceState\(['"]parsed['"]\)/)
    expect(INDEX_SOURCE).toMatch(/setVoiceState\(['"]error['"]\)/)
  })
})

describe('VoiceCard — correction mic wiring', () => {
  it('renders the correction mic button when onCorrection is provided', () => {
    expect(SOURCE).toContain('data-testid="voice-correction-mic"')
    expect(SOURCE).toMatch(/onClick=\{onCorrection\}/)
  })

  it('parent\'s startCorrection actually calls handleVoiceRecord (which calls getUserMedia)', () => {
    expect(INDEX_SOURCE).toContain('function startCorrection')
    expect(INDEX_SOURCE).toContain('correctingRef.current = true')
    expect(INDEX_SOURCE).toMatch(/handleVoiceRecord\(\)/)
    expect(INDEX_SOURCE).toContain('navigator.mediaDevices.getUserMedia')
  })
})

describe('VoiceCard — error surfaces', () => {
  it('renders voiceError block', () => {
    expect(SOURCE).toContain('data-testid="voice-error"')
  })

  it('renders ttsError block when speak() fails', () => {
    expect(SOURCE).toContain('data-testid="tts-error"')
    expect(SOURCE).toMatch(/speak\(confirmationText\)\.catch/)
  })

  it('parent surfaces "לא שמעתי כלום" when transcription is empty', () => {
    expect(INDEX_SOURCE).toContain('לא שמעתי כלום')
  })

  it('parent surfaces the exact error message from getUserMedia failures', () => {
    expect(INDEX_SOURCE).toMatch(/err\.message/)
    expect(INDEX_SOURCE).toContain("'NotAllowedError'")
    expect(INDEX_SOURCE).toContain("'NotFoundError'")
  })
})

describe('VoiceCard — debug block', () => {
  it('only renders in dev mode', () => {
    expect(SOURCE).toContain('import.meta')
    expect(SOURCE).toContain('DEV')
    expect(SOURCE).toContain('data-testid="voice-debug"')
  })

  it('exposes raw / parsed / source / state / tts / error', () => {
    expect(SOURCE).toMatch(/state:.*voiceState/)
    expect(SOURCE).toMatch(/source:.*parsed\.source/)
    expect(SOURCE).toMatch(/raw:.*rawTranscript/)
    expect(SOURCE).toMatch(/parsed:.*JSON\.stringify/)
    expect(SOURCE).toContain('confidence:')
    expect(SOURCE).toMatch(/tts:.*ttsError/)
    expect(SOURCE).toMatch(/error:.*voiceError/)
  })
})

describe('VoiceCard — raw transcript never becomes title silently', () => {
  it('the title input value is bound to the title state, not rawTranscript', () => {
    expect(SOURCE).toMatch(/value=\{title\}/)
    expect(SOURCE).not.toMatch(/value=\{rawTranscript\}[\s\S]*?onChange=\{e\s*=>\s*setTitle/)
  })

  it('save uses the trimmed editable title, not the transcript', () => {
    expect(SOURCE).toContain('title: trimmedTitle')
  })
})

describe('formatHebrewDateSlot', () => {
  const TODAY = '2026-04-30'

  it('today → היום', () => {
    expect(formatHebrewDateSlot('2026-04-30', TODAY)).toBe('היום')
  })

  it('tomorrow → מחר', () => {
    expect(formatHebrewDateSlot('2026-05-01', TODAY)).toBe('מחר')
  })

  it('day after tomorrow → מחרתיים', () => {
    expect(formatHebrewDateSlot('2026-05-02', TODAY)).toBe('מחרתיים')
  })

  it('further out → "15 במאי 2026" Hebrew form, not "May 2026 1"', () => {
    const out = formatHebrewDateSlot('2026-05-15', TODAY)
    expect(out).toBe('15 במאי 2026')
    expect(out).not.toContain('May')
  })

  it('null/missing → חסר', () => {
    expect(formatHebrewDateSlot(null, TODAY)).toBe('חסר')
    expect(formatHebrewDateSlot('', TODAY)).toBe('חסר')
  })
})
