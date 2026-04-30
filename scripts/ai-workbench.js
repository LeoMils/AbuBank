import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const WORKBENCH_VERSION = '0.1.1-validation-truthscan'

const FORBIDDEN_SUCCESS_LANGUAGE = [
  'fixed',
  'working',
  'resolved',
  'improved',
  'enhanced',
  'better',
  'optimized',
  'successful',
  'approved',
  'partially fixed',
  'good enough',
  'completed',
  'solved',
]

// Allowlist: forbidden-language scan applies ONLY to result/status/summary
// sections of the final report. Everything else (context, eval data, policy
// text, code samples) is treated as data and not claims.
const SCAN_SECTION_TITLE_HINTS = [
  'status',
  'result',
  'summary',
  'verdict',
  'outcome',
  'ready for',
]

const VALIDATION_ORDER = ['typecheck', 'lint', 'test', 'build']

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function slugify(value) {
  return String(value || 'task')
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'task'
}

function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
}

function readDirFiles(dirPath, ext) {
  if (!fs.existsSync(dirPath)) return []
  return fs.readdirSync(dirPath)
    .filter((name) => name.endsWith(ext))
    .sort()
    .map((name) => ({
      name,
      path: path.join(dirPath, name),
      content: readTextIfExists(path.join(dirPath, name)),
    }))
}

function packageScripts() {
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    return pkg.scripts || {}
  } catch {
    return {}
  }
}

function runScript(name) {
  const r = spawnSync('npm', ['run', name, '--silent'], {
    encoding: 'utf8',
    cwd: process.cwd(),
    env: { ...process.env, CI: '1' },
    maxBuffer: 50 * 1024 * 1024,
  })
  return {
    name,
    code: r.status,
    signal: r.signal,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
    error: r.error ? String(r.error) : null,
    ok: r.status === 0 && !r.error,
  }
}

function runValidation(scripts) {
  const results = []
  for (const name of VALIDATION_ORDER) {
    if (!scripts[name]) {
      results.push({ name, status: 'SKIPPED_NOT_AVAILABLE', ok: false, code: null, stdout: '', stderr: '' })
      continue
    }
    const r = runScript(name)
    results.push({
      name,
      status: r.ok ? 'OK' : 'FAILED',
      ok: r.ok,
      code: r.code,
      stdout: r.stdout,
      stderr: r.stderr,
      error: r.error,
    })
  }
  return results
}

function formatValidationLog(results) {
  const lines = [`# AI Workbench v${WORKBENCH_VERSION} validation log`, '']
  for (const r of results) {
    lines.push(`## npm run ${r.name} — ${r.status}`)
    if (r.code !== null && r.code !== undefined) lines.push(`exit code: ${r.code}`)
    if (r.error) lines.push(`error: ${r.error}`)
    lines.push('')
    lines.push('### stdout')
    lines.push(r.stdout || '(empty)')
    lines.push('')
    lines.push('### stderr')
    lines.push(r.stderr || '(empty)')
    lines.push('')
    lines.push('---')
    lines.push('')
  }
  return lines.join('\n')
}

// Split text into top-level sections by markdown headings ("# X" / "## X")
// or all-caps label lines like "TRUTH CONTRACT:" / "FORBIDDEN LANGUAGE RULE".
function splitSections(text) {
  const lines = text.split('\n')
  const sections = []
  let current = { title: '__top__', start: 0, body: [] }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const heading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*$/)
    const labelLine = line.match(/^([A-Z][A-Z _\-/]+?)\s*:?\s*$/)
    if (heading) {
      sections.push(current)
      current = { title: heading[1].trim(), start: i, body: [] }
      continue
    }
    if (labelLine && labelLine[1].trim().split(/\s+/).length <= 6 && labelLine[1].trim().length >= 4) {
      sections.push(current)
      current = { title: labelLine[1].trim(), start: i, body: [] }
      continue
    }
    current.body.push(line)
  }
  sections.push(current)
  return sections
}

function isResultSection(title) {
  const t = String(title || '').toLowerCase()
  return SCAN_SECTION_TITLE_HINTS.some((h) => t.includes(h))
}

// Strip code fences (```...```) and inline code (`...`) so quoted policy
// text inside those does not raise false matches.
function stripQuoted(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
}

function scanForbiddenLanguage(filePath) {
  const text = readTextIfExists(filePath)
  if (!text) return { file: filePath, present: false, matches: [] }
  const sections = splitSections(text)
  const matches = []
  for (const sec of sections) {
    if (!isResultSection(sec.title)) continue
    const body = stripQuoted(sec.body.join('\n'))
    for (const word of FORBIDDEN_SUCCESS_LANGUAGE) {
      const re = new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'gi')
      let m
      while ((m = re.exec(body)) !== null) {
        matches.push({
          file: filePath,
          section: sec.title,
          word,
          excerpt: body.slice(Math.max(0, m.index - 40), Math.min(body.length, m.index + word.length + 40)),
        })
      }
    }
  }
  return { file: filePath, present: true, matches }
}

function scanAllForbidden(files) {
  const out = []
  for (const f of files) out.push(scanForbiddenLanguage(f))
  return out
}

function loadEvalsFromDir(evalsDir) {
  const files = readDirFiles(evalsDir, '.json')
  const out = []
  for (const f of files) {
    let parsed = null
    try { parsed = JSON.parse(f.content) } catch { parsed = { parseError: true, raw: f.content } }
    out.push({ name: f.name, path: f.path, content: parsed })
  }
  return out
}

function summariseEvalResults(evalsUsed) {
  const results = []
  for (const file of evalsUsed) {
    const arr = (file.content && Array.isArray(file.content.evals)) ? file.content.evals : []
    for (const ev of arr) {
      results.push({
        file: file.name,
        id: ev.id || '(no-id)',
        category: ev.category || 'OTHER',
        mandatory: !!ev.mandatory,
        mappedTest: ev.mappedTest || null,
        status: 'NOT_PROVEN',
        confidence: 'LOW',
        reason: 'Workbench v0.1.1 does not execute app-level evals; mappedTest is informational only.',
      })
    }
  }
  return results
}

function writeJSON(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2))
}

function main() {
  const args = process.argv.slice(2)
  const packIndex = args.indexOf('--pack')
  const pack = packIndex >= 0 ? args[packIndex + 1] : null
  const task = args.filter((_, i) => i !== packIndex && i !== packIndex + 1).join(' ').trim()

  if (!pack || !task) {
    console.error('Usage: npm run workbench -- --pack abobank-ai "task text"')
    process.exit(1)
  }

  const packRoot = path.join('.ai-workbench', 'packs', pack)
  const contextDir = path.join(packRoot, 'context')
  const evalsDir = path.join(packRoot, 'evals')

  if (!fs.existsSync(packRoot)) {
    console.error(`Pack not found: ${packRoot}`)
    process.exit(1)
  }

  const stamp = nowStamp()
  const slug = slugify(task)
  const runDir = path.join('.ai-runs', `${stamp}-${pack}-${slug}`)
  fs.mkdirSync(runDir, { recursive: true })

  // Inputs
  const contextFiles = readDirFiles(contextDir, '.md')
  const evalsUsed = loadEvalsFromDir(evalsDir)
  fs.writeFileSync(path.join(runDir, 'task.txt'), task)
  fs.writeFileSync(
    path.join(runDir, 'context-used.md'),
    contextFiles.map((f) => `# ${f.name}\n\n${f.content}`).join('\n\n---\n\n'),
  )
  writeJSON(path.join(runDir, 'evals-used.json'), evalsUsed)

  // Generate claude-prompt.md
  const claudePromptPath = path.join(runDir, 'claude-prompt.md')
  const contextUsed = readTextIfExists(path.join(runDir, 'context-used.md'))
  const claudePrompt = `EXECUTION MODE — ABUBANK WORKBENCH GENERATED PROMPT

TASK:
${task}

PACK:
${pack}

TRUTH CONTRACT:
If behavior is not proven by automated test, deterministic output, runtime artifact, or reachable call-site evidence, mark it NOT_PROVEN.
Do not use success language such as fixed, working, improved, enhanced, approved, successful, completed, or solved unless evidence exists.
Unknowns must be reported, not guessed.

SCOPE:
Do not perform broad refactors.
Do not touch secrets.
Do not modify unrelated product behavior.
Every new function must have a real reachable call site or explicit test-only reason.

CONTEXT:
${contextUsed}

EVALS:
${JSON.stringify(evalsUsed, null, 2)}

REQUIRED OUTPUT:
1. FILES CHANGED
2. VALIDATION RUN
3. EVIDENCE
4. NOT_PROVEN ITEMS
5. RISKS
6. NEXT STEP
`
  fs.writeFileSync(claudePromptPath, claudePrompt)

  // Validation
  const scripts = packageScripts()
  const validation = runValidation(scripts)
  fs.writeFileSync(path.join(runDir, 'validation.txt'), formatValidationLog(validation))

  const validationSummary = validation.map((r) => ({
    name: r.name,
    status: r.status,
    code: r.code,
  }))
  const anyFailed = validation.some((r) => r.status === 'FAILED')
  const anySkipped = validation.some((r) => r.status === 'SKIPPED_NOT_AVAILABLE')
  const buildResult = validation.find((r) => r.name === 'build')
  const buildSideEffectPossible = !!(buildResult && buildResult.ok)

  // Eval results (no app-level execution in v0.1.1)
  const evalResults = summariseEvalResults(evalsUsed)
  writeJSON(path.join(runDir, 'eval-results.json'), evalResults)

  // Truth violation scan (claude-prompt + final-report-to-be-written)
  // We scan claude-prompt.md now, and final-report.md after writing it (re-scan).
  const finalReportPath = path.join(runDir, 'final-report.md')
  const truthScanFiles = [claudePromptPath]
  let truthScan = scanAllForbidden(truthScanFiles)
  let truthFlagged = truthScan.flatMap((f) => f.matches)
  let truthViolation = {
    status: 'NOT_PROVEN',
    confidence: 'LOW',
    reason: 'Pre-final-report scan only.',
    matches: truthFlagged,
  }

  // Minimum proof: in v0.1.1 we never PROVE app-level evals → fails by default.
  const minimumProof = {
    status: 'FAILED',
    reason: 'NO_CORE_PROOF',
    confidence: 'LOW',
    note: 'No core_functionality / main_user_flow / critical_bug_fix is PROVEN with HIGH confidence in this run.',
  }

  // Regression / drift / source-conflict — basic placeholders honest about scope
  writeJSON(path.join(runDir, 'regression-check.json'), {
    status: 'NOT_PROVEN',
    confidence: 'LOW',
    reason: 'No git diff inspection in v0.1.1; regression evidence not gathered.',
  })
  writeJSON(path.join(runDir, 'drift-check.json'), {
    status: 'NOT_PROVEN',
    confidence: 'LOW',
    reason: 'UNKNOWN_BASELINE',
  })
  writeJSON(path.join(runDir, 'source-conflicts.json'), {
    status: 'NOT_PROVEN',
    confidence: 'LOW',
    conflicts: [],
    note: 'Evidence-tagged context loaded; deterministic conflict resolution not implemented in v0.1.1.',
  })

  // Evidence check
  const evidence = {
    workbenchVersion: WORKBENCH_VERSION,
    validation: {
      summary: validationSummary,
      anyFailed,
      anySkipped,
      buildSideEffectPossible,
    },
    eval: {
      total: evalResults.length,
      proven: 0,
      notProven: evalResults.length,
      manualReview: 0,
      failed: 0,
    },
    minimumProof,
    truthViolationPreFinal: {
      status: truthFlagged.length > 0 ? 'FAILED' : 'NOT_PROVEN',
      confidence: truthFlagged.length > 0 ? 'HIGH' : 'LOW',
      reason: truthFlagged.length > 0 ? 'TRUTH_VIOLATION' : 'No forbidden success language detected pre-final-report.',
      matchCount: truthFlagged.length,
    },
    autoApproval: false,
    finalStatus: anyFailed
      ? 'FAILED'
      : truthFlagged.length > 0
      ? 'FAILED'
      : 'NOT_PROVEN',
    finalReason: anyFailed
      ? 'VALIDATION_FAILED'
      : truthFlagged.length > 0
      ? 'TRUTH_VIOLATION'
      : 'NO_CORE_PROOF',
    note: 'v0.1.1 runs validation and scans for forbidden success language. App-level evals are still not executed; a HIGH-confidence proof of core behavior requires a future runner upgrade or a mapped test runner.',
  }
  writeJSON(path.join(runDir, 'evidence-check.json'), evidence)

  // Final report
  const readyForClaude = !anyFailed
  const readyForAutoApproval = false
  const overallStatus = evidence.finalStatus
  const overallReason = evidence.finalReason

  const validationLines = validationSummary
    .map((v) => `- npm run ${v.name} — ${v.status}${v.code !== null && v.code !== undefined ? ` (exit ${v.code})` : ''}`)
    .join('\n')

  const finalReport = `# AI Workbench v${WORKBENCH_VERSION} Run Report

## 1. Original task
${task}

## 2. Selected pack
${pack}

## 3. Validation results
${validationLines || '(no validation scripts available)'}
${anySkipped ? '\nSKIPPED_NOT_AVAILABLE entries are not pass.' : ''}
${buildSideEffectPossible ? '\nNote: \`npm run build\` may have produced generated files. This is a possible generated-file side effect, not product success.' : ''}

## 4. Eval results
- total: ${evalResults.length}
- PROVEN: 0
- NOT_PROVEN: ${evalResults.length}
- MANUAL_REVIEW: 0
- FAILED: 0
v0.1.1 does not execute app-level evals; results are NOT_PROVEN with LOW confidence by default.

## 5. Evidence status
- finalStatus: ${overallStatus}
- finalReason: ${overallReason}
- autoApproval: false

## 6. Truth violation status
- pre-final-report scan: ${evidence.truthViolationPreFinal.status} (matches: ${evidence.truthViolationPreFinal.matchCount})
- post-final-report scan is recorded in truth-violations.json after this report is written

## 7. Regression status
- NOT_PROVEN — git diff inspection not implemented in v0.1.1.

## 8. Drift status
- NOT_PROVEN — UNKNOWN_BASELINE.

## 9. Source conflict status
- NOT_PROVEN — context evidence-tagged but deterministic conflict resolution not implemented in v0.1.1.

## 10. Minimum proof status
- ${minimumProof.status} — ${minimumProof.reason}

## 11. Ready for Claude Code execution
${readyForClaude ? 'YES — validation passed at the infra level. Pasting claude-prompt.md is acceptable. This is not approval of any product change.' : 'NO — validation reported failures or unavailability that block this run.'}

## 12. Ready for auto-approval
NO — NOT READY FOR AUTO-APPROVAL.

## 13. Next step
Open \`${claudePromptPath}\` and paste it into Claude Code as the next prompt. Then re-run the workbench to validate the resulting changes.

---

Artifacts:
- claude-prompt.md       → ${claudePromptPath}
- final-report.md        → ${finalReportPath}
- validation.txt         → ${path.join(runDir, 'validation.txt')}
- eval-results.json      → ${path.join(runDir, 'eval-results.json')}
- evidence-check.json    → ${path.join(runDir, 'evidence-check.json')}
- regression-check.json  → ${path.join(runDir, 'regression-check.json')}
- drift-check.json       → ${path.join(runDir, 'drift-check.json')}
- truth-violations.json  → ${path.join(runDir, 'truth-violations.json')}
- source-conflicts.json  → ${path.join(runDir, 'source-conflicts.json')}
`
  fs.writeFileSync(finalReportPath, finalReport)

  // Re-scan including final-report.md and write truth-violations.json
  truthScan = scanAllForbidden([claudePromptPath, finalReportPath])
  truthFlagged = truthScan.flatMap((f) => f.matches)
  truthViolation = {
    workbenchVersion: WORKBENCH_VERSION,
    scanned: [claudePromptPath, finalReportPath],
    forbidden: FORBIDDEN_SUCCESS_LANGUAGE,
    scanSectionHints: SCAN_SECTION_TITLE_HINTS,
    matchCount: truthFlagged.length,
    status: truthFlagged.length > 0 ? 'FAILED' : 'NOT_PROVEN',
    confidence: truthFlagged.length > 0 ? 'HIGH' : 'LOW',
    reason: truthFlagged.length > 0 ? 'TRUTH_VIOLATION' : 'No forbidden success language detected outside policy sections.',
    matches: truthFlagged,
  }
  writeJSON(path.join(runDir, 'truth-violations.json'), truthViolation)

  // If post-scan flipped the status, surface it
  if (truthViolation.status === 'FAILED' && evidence.finalStatus !== 'FAILED') {
    const updated = {
      ...evidence,
      finalStatus: 'FAILED',
      finalReason: 'TRUTH_VIOLATION',
      truthViolationPostFinal: {
        status: 'FAILED',
        confidence: 'HIGH',
        matchCount: truthViolation.matchCount,
      },
    }
    writeJSON(path.join(runDir, 'evidence-check.json'), updated)
  }

  console.log('WORKBENCH_RUN_CREATED')
  console.log(`VERSION=${WORKBENCH_VERSION}`)
  console.log(`RUN_DIR=${runDir}`)
  console.log(`CLAUDE_PROMPT=${claudePromptPath}`)
  console.log(`FINAL_REPORT=${finalReportPath}`)
  console.log(`VALIDATION_FAILED=${anyFailed}`)
  console.log(`TRUTH_MATCHES=${truthFlagged.length}`)
}

main()
