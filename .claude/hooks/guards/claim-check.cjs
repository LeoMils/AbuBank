#!/usr/bin/env node
'use strict'
/*
 * Stop hook — evidence/claim advisory. ADVISORY ONLY: it never blocks a response
 * (always exit 0). It reminds when the final message asserts success words without
 * a nearby evidence marker, so unsupported "fixed/works/ready" claims get a second
 * look. Hard enforcement is deliberately deferred to avoid false-positive blocking.
 * Disable: ABU_HOOKS_DISABLE=1.
 */
const { DISABLED, parseInput, fs } = require('./_lib.cjs')

const CLAIM = /\b(fixed|works now|resolved|production-ready|production ready|ready to ship|it works|fully working|solved|guaranteed)\b/i
const EVIDENCE = /(exit 0|npm run|vitest|tests? pass|passed \(|PASS\b|evidence class|CODE\b|MOCK\b|BROWSER\b|PREVIEW\b|PHYSICAL_DEVICE|PRODUCTION|first divergence|not proven|requires (evidence|manual))/i

try {
  if (DISABLED) process.exit(0)
  const input = parseInput()
  const tp = input.transcript_path || input.transcriptPath
  if (!tp || !fs.existsSync(tp)) process.exit(0)

  let lastAssistant = ''
  try {
    const lines = fs.readFileSync(tp, 'utf8').trim().split('\n')
    for (let i = lines.length - 1; i >= 0 && !lastAssistant; i--) {
      try {
        const o = JSON.parse(lines[i])
        const msg = o.message || o
        if ((o.type === 'assistant' || msg.role === 'assistant')) {
          const content = msg.content
          if (typeof content === 'string') lastAssistant = content
          else if (Array.isArray(content)) lastAssistant = content.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n')
        }
      } catch {}
    }
  } catch {}

  if (lastAssistant && CLAIM.test(lastAssistant) && !EVIDENCE.test(lastAssistant)) {
    process.stderr.write('💡 Abu claim-check (advisory): the response asserts success ("fixed/works/ready") ' +
      'without a nearby evidence marker (a passing command, an evidence class, or a first-divergence). ' +
      'Consider stating the evidence class or downgrading the wording. Not blocking.\n')
  }
  process.exit(0)
} catch (_e) {
  process.exit(0)
}
