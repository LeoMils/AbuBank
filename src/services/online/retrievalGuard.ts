/*
 * retrievalGuard.ts — retrieved web content is UNTRUSTED DATA, never control-plane authority. (A6)
 * ════════════════════════════════════════════════════════════════════════════════════════════════
 * The online path fetches arbitrary pages and hands their text to a cheap model to synthesize ONE
 * answer. A hostile page can try to hijack that model: override instructions, extract the system
 * prompt / a secret, invoke a tool, change a recipient, forge freshness/authority, or forge a
 * citation. The PRIMARY defense is architectural — the online endpoint returns a synthesized STRING
 * and executes nothing (no tool call, no recipient, no secret in the synthesis prompt). This adds
 * DEFENSE IN DEPTH: it neutralizes injection DIRECTIVES in fetched text before synthesis so the model
 * cannot even parrot them, WITHOUT removing factual content (a filtered line becomes a placeholder,
 * surrounding facts survive). Evidence may inform an answer; it may never become authority.
 */

// Injection DIRECTIVES (imperative meta-instructions), not factual content. HE/ES/EN.
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|above|prior|the)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(the\s+)?(system|previous|above|earlier)/i,
  /\byou\s+are\s+now\b/i,
  /new\s+(instructions?|system\s+prompt|rules?)/i,
  /^\s*system\s*:/im,
  /(reveal|print|show|output|repeat|leak|expose|send)\s+(me\s+)?(your|the)\s+(system\s+prompt|instructions?|api[\s_-]*key|secret|password|token|credentials?)/i,
  /\bcall\s+(the\s+)?(tool|function)\b/i,
  /"?(function_call|tool_call|tool_calls)"?\s*[:=]/i,
  // recipient change / exfiltration to a phone or email
  /(send|message|whatsapp|call|email|forward)\b[^\n]{0,40}(\+?\d[\d\s().-]{6,}|@[\w.-]+\.\w+)/i,
  // forged freshness / authority (retrieved text asserting it IS the current/authoritative truth)
  /this\s+(information\s+)?is\s+(the\s+)?(current|latest|most\s+up[\s-]?to[\s-]?date|authoritative|official)\b/i,
  /according\s+to\s+(your|the)\s+(system|instructions?|rules?)/i,
  // Hebrew/Spanish common forms
  /התעלמ[יי]?\s+מ(כל\s+)?ההוראות/i,
  /ignor[aá]\s+(las\s+)?(instrucciones|reglas)\s+(anteriores|previas)/i,
]

export interface RetrievalScan {
  /** True when no injection directive was found. */
  clean: boolean
  /** How many lines were neutralized. */
  injectionHits: number
  /** The text with injection-directive lines replaced by a placeholder; facts preserved. */
  sanitized: string
}

/**
 * Neutralize injection directives in retrieved page text before it is synthesized. Line-oriented so a
 * factual line is never dropped for containing an unlucky word — only lines that ARE a meta-instruction
 * are replaced with "[removed non-content directive]". Never throws.
 */
export function sanitizeRetrievedText(text: string): RetrievalScan {
  const raw = typeof text === 'string' ? text : ''
  let injectionHits = 0
  const sanitized = raw
    .split(/\r?\n/)
    .map((line) => {
      if (INJECTION_PATTERNS.some((re) => re.test(line))) { injectionHits++; return '[removed non-content directive]' }
      return line
    })
    .join('\n')
  return { clean: injectionHits === 0, injectionHits, sanitized }
}
