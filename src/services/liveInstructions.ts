/*
 * liveInstructions.ts — Abu AI, Milestone 2: the live-session instructions,
 * assembled AT BUILD TIME from two editable knowledge files.
 * ════════════════════════════════════════════════════════════════════════════
 * Milestone 1 hard-coded Abu's system prompt as a string in liveSession.ts. M2
 * moves the CONTENT out to two files Leo edits in Hebrew:
 *
 *   knowledge/abu-persona-draft.md   → who Abu is (personality, tone, language)
 *   knowledge/abu-knowledge.md       → the facts Abu knows (Martita + family)
 *
 * Both are inlined here via Vite's `?raw` import, so their text is baked into the
 * bundle AT BUILD TIME. Editing knowledge/abu-knowledge.md and redeploying reaches
 * Abu on the next deploy with NO code change (the requirement) — the file is the
 * source, this module only frames it.
 *
 * Assembly order (the requirement): persona FIRST, then the knowledge file. Each
 * file's editor-facing preamble (the note-to-Leo above its first `---`) is stripped
 * so it never reaches Abu; everything after the first `---` is used verbatim.
 *
 * Abu is FEMALE; all Hebrew is feminine. She follows the user between Hebrew and
 * Rioplatense (Argentine) Spanish. The frame uses the labeled sections from the
 * OpenAI Realtime prompting guide and stays tight — no conflicting always/never
 * rules (the persona's prose and the frame's operational rules point the same way).
 *
 * A build-time guard (assertNoPhoneNumbers, run at module load) FAILS the build if
 * a phone number ever appears in either file — phone numbers live only in contacts,
 * never in Abu's knowledge or instructions.
 */
import personaRaw from '../../knowledge/abu-persona-draft.md?raw'
import knowledgeRaw from '../../knowledge/abu-knowledge.md?raw'

/**
 * Drop the editor-facing preamble: everything up to and INCLUDING the first
 * horizontal rule (`---`). Both files open with a note to Leo ("this is a draft…",
 * "Leo edits this file…") that must never reach Abu. Everything after the first
 * `---` is Abu's actual persona/knowledge and is returned verbatim (trimmed).
 * A file with no `---` is returned trimmed as-is (nothing to strip).
 */
export function stripEditorPreamble(md: string): string {
  const text = md.replace(/\r\n/g, '\n')
  const m = text.match(/^---[ \t]*$/m)
  if (!m || m.index === undefined) return text.trim()
  const after = text.slice(m.index + m[0].length)
  return after.trim()
}

/**
 * Find phone-number-shaped tokens: any run of digits and phone punctuation
 * (spaces, +, -, (), .) whose DIGIT count is ≥ 9. That threshold clears real
 * phone numbers (Israeli mobile = 10 digits, +972… international) while leaving
 * years (2026), ages, and full dates (YYYY-MM-DD = 8 digits) untouched.
 */
export function findPhoneNumbers(text: string): string[] {
  const hits: string[] = []
  const runs = text.match(/[+(]?\d[\d\s().+-]{6,}\d/g) ?? []
  for (const run of runs) {
    const digits = run.replace(/\D/g, '')
    if (digits.length >= 9) hits.push(run.trim())
  }
  return hits
}

/** Throw (fail the build/import) if `text` contains a phone number. */
export function assertNoPhoneNumbers(text: string, source: string): void {
  const hits = findPhoneNumbers(text)
  if (hits.length > 0) {
    throw new Error(
      `[liveInstructions] phone number(s) found in ${source}: ${hits.join(', ')} — ` +
        'phone numbers must never appear in Abu\'s knowledge or instructions (they live only in contacts)',
    )
  }
}

// Build-time enforcement: importing this module (which the build and the tests do)
// throws if either source file carries a phone number. Checked against the RAW file
// so a number hidden in the stripped preamble is still caught.
assertNoPhoneNumbers(personaRaw, 'knowledge/abu-persona-draft.md')
assertNoPhoneNumbers(knowledgeRaw, 'knowledge/abu-knowledge.md')

/** Abu's persona, verbatim after its editor preamble. */
export const ABU_PERSONA = stripEditorPreamble(personaRaw)

/** Abu's knowledge, verbatim after its editor preamble. */
export const ABU_KNOWLEDGE = stripEditorPreamble(knowledgeRaw)

/**
 * The full live-session instruction string. Labeled sections (OpenAI Realtime
 * prompting guide), persona first, then the knowledge file verbatim. Pure and
 * deterministic so it can be regression-locked.
 */
export function buildLiveInstructions(): string {
  return [
    '# Role and Objective',
    'You are Abu — a warm, familiar woman having a real conversation with Martita, a woman in her 80s in Kfar Saba. You are her close friend on the phone, not an assistant and not a menu.',
    '',
    '# Personality and Tone',
    'Abu is a woman and speaks about herself in the feminine; all Hebrew is feminine (מדברת, שומעת, כאן). This is who Abu is — embody it, do not recite it:',
    '',
    ABU_PERSONA,
    '',
    '# Language',
    "Follow Martita's language. Hebrew by default; when she speaks Spanish, answer in Rioplatense (Argentine) Spanish (vos tenés, vos sabés). Switch only on the language she actually speaks — never on accent — and never remark on the language.",
    '',
    '# What Abu Knows',
    'Everything below is what Abu knows. If a detail is not here, Abu does not know it and says so plainly — she never invents a name, date, or fact.',
    '',
    ABU_KNOWLEDGE,
    '',
    '# Length',
    'Two to four short spoken sentences. Give the direct answer first; add detail only if she asks.',
    '',
    '# Unclear Audio',
    'If the audio is silence, background noise, a TV or radio, or speech clearly not addressed to you, call the wait_for_user tool and stay quiet. Do not guess, do not ask "are you there?", do not repeat yourself.',
  ].join('\n')
}
