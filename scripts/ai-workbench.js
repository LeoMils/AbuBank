import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const WORKBENCH_VERSION = '0.4.0-review-repair-loop'

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

// Phrases the task or prompt may use to forbid git actions. Detection drives
// the safety-check and the constraint block injected into claude-prompt.md.
const SAFETY_FORBIDDEN_PHRASES = [
  'do not commit',
  'do not push',
  'do not merge',
  'do not run git add',
  'do not run git commit',
  'do not run git push',
  'do not auto-commit',
  'do not auto-push',
  'do not auto-merge',
]

// Action-claim patterns for the safety scanner. Each pattern requires a verb
// of action (ran / committed / pushed / merged / completed / auto-…). Policy
// text such as "do not run git push" is filtered out at the line level (any
// line containing "do not" is skipped) so quoted constraints don't false-
// positive. The patterns are intentionally narrow.
const SAFETY_VIOLATION_INDICATORS = [
  /(?:^|[^a-z])(?:i\s+|we\s+|just\s+)?ran\s+git\s+(?:add|commit|push|merge)\b/i,
  /(?:^|[^a-z])(?:i\s+|we\s+|just\s+)?committed\s+(?:to|the|on|with|and)\b/i,
  /(?:^|[^a-z])(?:i\s+|we\s+|just\s+)?pushed\s+(?:to|the|on|origin|main)\b/i,
  /(?:^|[^a-z])(?:i\s+|we\s+|just\s+)?merged\s+(?:into|to|with)\b/i,
  /\bgit\s+(?:push|commit|merge)\s+completed\b/i,
  /\bauto-?(?:merge[d]?|push(?:ed)?|commit(?:ted)?)\b/i,
  /\bcommit\s+[0-9a-f]{7,}\s+pushed\b/i,
]

// Any line containing one of these substrings is policy/constraint text and
// is skipped entirely by the safety scanner.
const SAFETY_POLICY_LINE_MARKERS = [
  'do not',
  'requested constraints:',
  'preserved in claude-prompt',
  'preserved in final-report',
  'forbiddengitactionsrequested',
  'safety_constraint',
  'safety_violation',
  'forbidden actions',
]

function detectSafetyConstraints(text) {
  const lc = String(text || '').toLowerCase()
  const found = []
  for (const p of SAFETY_FORBIDDEN_PHRASES) {
    if (lc.includes(p)) found.push(p)
  }
  return found
}

function scanSafetyViolationsInResultSections(filePath) {
  const text = readTextIfExists(filePath)
  if (!text) return []
  const sections = splitSections(text)
  const matches = []
  for (const sec of sections) {
    if (!isResultSection(sec.title)) continue
    const lines = stripQuoted(sec.body.join('\n')).split('\n')
    for (const rawLine of lines) {
      const line = rawLine
      const lc = line.toLowerCase()
      if (SAFETY_POLICY_LINE_MARKERS.some((p) => lc.includes(p))) continue
      for (const re of SAFETY_VIOLATION_INDICATORS) {
        const gre = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
        let m
        while ((m = gre.exec(line)) !== null) {
          matches.push({
            file: filePath,
            section: sec.title,
            pattern: re.source,
            line: line.trim(),
          })
        }
      }
    }
  }
  return matches
}

function gitStatusShort() {
  const r = spawnSync('git', ['status', '--short'], { encoding: 'utf8', cwd: process.cwd() })
  if (r.status !== 0) return { ok: false, stdout: '', stderr: r.stderr || '', error: r.error ? String(r.error) : null }
  return { ok: true, stdout: r.stdout || '', stderr: '', error: null }
}

function parseGitStatus(stdout) {
  const lines = stdout.split('\n').filter(Boolean)
  const files = []
  for (const line of lines) {
    // Format: "XY path" where XY is two status chars; rename uses "R  old -> new"
    const status = line.slice(0, 2)
    let pathPart = line.slice(3)
    if (pathPart.includes(' -> ')) pathPart = pathPart.split(' -> ').pop()
    files.push({ status, path: pathPart })
  }
  return files
}

function classifyChangedFile(filePath, pack) {
  const allowed = pack?.allowedPaths || []
  const forbidden = pack?.forbiddenPaths || []
  const isInside = (root) => filePath === root || filePath.startsWith(root + '/')
  const isForbidden = forbidden.some(isInside)
  const isAllowed = allowed.some(isInside)
  const isPackage = filePath === 'package.json' || filePath === 'package-lock.json'
  const isEnv = /^\.env(\.|$)/.test(filePath)
  const isMemory = filePath.startsWith('memory/')
  const isGenerated = filePath.startsWith('dist/') || filePath.startsWith('.ai-runs/') || isMemory
  const isWorkbenchInfra = filePath.startsWith('.ai-workbench/') || filePath === 'scripts/ai-workbench.js' || filePath.startsWith('.claude/')
  let bucket = 'unrelated'
  if (isPackage) bucket = 'packageFiles'
  else if (isEnv) bucket = 'forbiddenSecrets'
  else if (isForbidden) bucket = 'forbiddenPaths'
  else if (isGenerated) bucket = 'generatedFiles'
  else if (isWorkbenchInfra) bucket = 'workbenchInfra'
  else if (isAllowed) bucket = 'allowedPaths'
  return { path: filePath, bucket }
}

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
        reason: 'NO_MAPPED_TEST',
        command: null,
        exitCode: null,
        evidenceSummary: 'No mappedTest declared; eval is informational only.',
      })
    }
  }
  return results
}

// v0.2: execute the vitest file each mapped eval points at. Group evals by
// mappedTest so each unique file runs once. A passing mapped file flips its
// evals to PROVEN/HIGH; failure → FAILED/HIGH; missing file → FAILED/HIGH.
// One mapped file proves only the evals that explicitly reference it.
function executeMappedTests(evalResults) {
  const byPath = new Map()
  for (const e of evalResults) {
    if (!e.mappedTest) continue
    if (!byPath.has(e.mappedTest)) byPath.set(e.mappedTest, [])
    byPath.get(e.mappedTest).push(e)
  }
  const runs = []
  for (const [testPath, evals] of byPath) {
    const command = `npx vitest run ${testPath}`
    if (!fs.existsSync(testPath)) {
      for (const e of evals) {
        e.status = 'FAILED'
        e.confidence = 'HIGH'
        e.reason = 'MAPPED_TEST_FILE_MISSING'
        e.command = command
        e.exitCode = null
        e.evidenceSummary = `mappedTest path does not exist on disk: ${testPath}`
      }
      runs.push({
        path: testPath, ok: false, code: null,
        reason: 'MAPPED_TEST_FILE_MISSING',
        command, evalIds: evals.map((e) => e.id),
      })
      continue
    }
    const r = spawnSync('npx', ['vitest', 'run', testPath, '--reporter=default'], {
      encoding: 'utf8',
      cwd: process.cwd(),
      env: { ...process.env, CI: '1' },
      maxBuffer: 50 * 1024 * 1024,
    })
    const ok = r.status === 0 && !r.error
    const reason = ok ? 'MAPPED_TEST_PASSED' : 'MAPPED_TEST_FAILED'
    const tail = (r.stdout || '').split('\n').slice(-12).join('\n')
    for (const e of evals) {
      e.status = ok ? 'PROVEN' : 'FAILED'
      e.confidence = 'HIGH'
      e.reason = reason
      e.command = command
      e.exitCode = r.status
      e.evidenceSummary = ok
        ? `Mapped vitest file passed (exit 0): ${testPath}. tail:\n${tail}`
        : `Mapped vitest file failed (exit ${r.status}${r.error ? `, error: ${r.error}` : ''}): ${testPath}. tail:\n${tail}`
    }
    runs.push({
      path: testPath, ok, code: r.status,
      reason,
      command,
      evalIds: evals.map((e) => e.id),
      stdout: r.stdout || '',
      stderr: r.stderr || '',
      error: r.error ? String(r.error) : null,
    })
  }
  return runs
}

function countEvals(evalResults) {
  const c = { proven: 0, notProven: 0, manualReview: 0, failed: 0 }
  for (const e of evalResults) {
    if (e.status === 'PROVEN') c.proven++
    else if (e.status === 'FAILED') c.failed++
    else if (e.status === 'MANUAL_REVIEW') c.manualReview++
    else c.notProven++
  }
  return c
}

const CORE_PROOF_CATEGORIES = ['core_functionality', 'main_user_flow', 'critical_bug_fix']

function computeMinimumProof(evalResults) {
  const proven = evalResults.filter(
    (e) => e.mandatory
      && e.status === 'PROVEN'
      && e.confidence === 'HIGH'
      && CORE_PROOF_CATEGORIES.includes(e.category),
  )
  if (proven.length > 0) {
    return {
      status: 'PROVEN',
      reason: 'CORE_PROOF_OBSERVED',
      confidence: 'HIGH',
      provenCount: proven.length,
      provenIds: proven.map((e) => e.id),
      note: 'At least one mandatory core_functionality / main_user_flow / critical_bug_fix eval is PROVEN with HIGH confidence via mapped vitest execution.',
    }
  }
  return {
    status: 'FAILED',
    reason: 'NO_CORE_PROOF',
    confidence: 'LOW',
    provenCount: 0,
    provenIds: [],
    note: 'No mandatory core_functionality / main_user_flow / critical_bug_fix eval is PROVEN with HIGH confidence in this run.',
  }
}

// v0.3 static analysis ---------------------------------------------------
// Conservative, regex-based reachability check. No AST, no dependency.
// "Defining files" = source files inside the pack's allowedPaths (excluding
// tests). Every project file under src/ is a candidate "usage" file.
//
// A symbol's classification:
//   PROVEN_USED_IN_USER_FLOW  — referenced in a non-test source file outside
//                               its defining file
//   PROVEN_USED_IN_TEST       — referenced only in test files
//   TEST_ONLY_EXPLICIT        — preceding line carries `// test-only` /
//                               `@test-only` marker
//   MANUAL_REVIEW_DYNAMIC_USAGE — only seen in barrel re-exports / type-only
//                                imports → cannot be proven reachable
//   NOT_PROVEN_NO_USAGE       — no reference outside the defining file
const STATIC_PROJECT_ROOTS = ['src']
const STATIC_FILE_EXTS = ['.ts', '.tsx', '.js', '.jsx']
const STATIC_IGNORE_DIRS = new Set(['node_modules', 'dist', '.ai-runs', '.git', '.vite', 'coverage'])

function staticWalkFiles(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const ent of entries) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (STATIC_IGNORE_DIRS.has(ent.name)) continue
      out.push(...staticWalkFiles(full))
    } else if (ent.isFile() && STATIC_FILE_EXTS.some((e) => ent.name.endsWith(e))) {
      out.push(full)
    }
  }
  return out
}

function staticIsTestFile(file) {
  return /\.test\.(ts|tsx|js|jsx)$/.test(file)
}

function staticIsWithinPackAllowed(file, allowedRoots) {
  return allowedRoots.some((r) => file === r || file.startsWith(r + '/') || file.startsWith(r + path.sep))
}

function staticExtractExports(file, src) {
  const lines = src.split('\n')
  const exports = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const prev = i > 0 ? lines[i - 1] : ''
    const testOnlyMarker = /(?:\/\/|\/\*|\*)\s*@?test-only\b/i.test(prev) || /(?:\/\/|\/\*|\*)\s*@?test-only\b/i.test(line)
    const annotation = staticExtractKeepAnnotation(lines, i)

    let m = line.match(/^\s*export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/)
    if (m) { exports.push({ name: m[1], kind: 'function', file, line: i + 1, testOnly: testOnlyMarker, annotation }); continue }

    m = line.match(/^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[=:]/)
    if (m) { exports.push({ name: m[1], kind: 'const', file, line: i + 1, testOnly: testOnlyMarker, annotation }); continue }

    m = line.match(/^\s*export\s+class\s+([A-Za-z_$][\w$]*)/)
    if (m) { exports.push({ name: m[1], kind: 'class', file, line: i + 1, testOnly: testOnlyMarker, annotation }); continue }
    // export type/interface/enum and export {...} from / export default are deliberately skipped.
  }
  return exports
}

const STATIC_KEEP_ALLOWED_KINDS = ['FUTURE_API', 'KEEP', 'TEST_ONLY', 'DYNAMIC_USAGE']

// Parse a `@workbench-keep` annotation block. The annotation must sit
// immediately above the export (no blank line gap) or on the export line.
// Within the contiguous comment block the marker line itself, plus
// reason/owner/reviewAfter fields, can appear in any order.
// Returns null if no marker found, or a metadata object with status:
// VALID | INVALID | EXPIRED.
function staticExtractKeepAnnotation(lines, exportIdx) {
  const exportLine = lines[exportIdx] || ''
  const blockLines = []
  if (/@workbench-keep\b/.test(exportLine)) blockLines.push(exportLine)
  // Walk upward collecting the contiguous comment block immediately above.
  for (let j = exportIdx - 1; j >= 0; j--) {
    const t = lines[j].trim()
    if (t === '') break
    const isComment = t.startsWith('//') || t.startsWith('*') || t.startsWith('/*') || t.endsWith('*/')
    if (!isComment) break
    blockLines.unshift(lines[j])
  }
  if (blockLines.length === 0) return null
  const blockText = blockLines.join('\n')
  if (!/@workbench-keep\b/.test(blockText)) return null

  const stripped = blockLines.map((l) => l
    .replace(/^\s*\/\/+\s?/, '')
    .replace(/^\s*\/\*+\s?/, '')
    .replace(/\s*\*+\/\s*$/, '')
    .replace(/^\s*\*+\s?/, '')
  ).join('\n')

  const parsed = { kind: null, reason: null, owner: null, reviewAfter: null }
  const kindMatch = stripped.match(/@workbench-keep\s+([A-Z_][A-Z_0-9]*)/)
  if (kindMatch) parsed.kind = kindMatch[1]
  const reasonMatch = stripped.match(/(?:^|\n)\s*reason\s*:\s*(.+?)(?:\n|$)/i)
  if (reasonMatch && reasonMatch[1].trim()) parsed.reason = reasonMatch[1].trim()
  const ownerMatch = stripped.match(/(?:^|\n)\s*owner\s*:\s*(.+?)(?:\n|$)/i)
  if (ownerMatch && ownerMatch[1].trim()) parsed.owner = ownerMatch[1].trim()
  const reviewMatch = stripped.match(/(?:^|\n)\s*reviewAfter\s*:\s*([^\s\n]+)/i)
  if (reviewMatch) parsed.reviewAfter = reviewMatch[1].trim()

  const errors = []
  if (!parsed.kind) errors.push('MISSING_KIND')
  else if (!STATIC_KEEP_ALLOWED_KINDS.includes(parsed.kind)) errors.push('INVALID_KIND')
  if (!parsed.reason) errors.push('MISSING_REASON')
  if (!parsed.owner) errors.push('MISSING_OWNER')
  if (!parsed.reviewAfter) errors.push('MISSING_REVIEW_AFTER')
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.reviewAfter)) errors.push('INVALID_REVIEW_AFTER_FORMAT')

  let status = 'VALID'
  if (errors.length > 0) {
    status = 'INVALID'
  } else {
    const today = new Date().toISOString().slice(0, 10)
    if (parsed.reviewAfter < today) status = 'EXPIRED'
  }

  return { ...parsed, status, errors }
}

function staticStripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^.*\/\/.*$/gm, (line) => line.split('//')[0])
}

function staticEscapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function staticFindUsages(symbol, definingFile, projectFiles, fileCache) {
  const usages = { userFlow: [], test: [], reExport: [], typeOnly: [] }
  const wordRe = new RegExp(`(?<![A-Za-z0-9_$])${staticEscapeRe(symbol)}(?![A-Za-z0-9_$])`)
  const typeImportRe = new RegExp(
    `import\\s+type\\s*\\{[^}]*(?<![A-Za-z0-9_$])${staticEscapeRe(symbol)}(?![A-Za-z0-9_$])[^}]*\\}`,
  )
  const reExportRe = new RegExp(
    `export\\s*\\{[^}]*(?<![A-Za-z0-9_$])${staticEscapeRe(symbol)}(?![A-Za-z0-9_$])[^}]*\\}\\s*from`,
  )
  for (const file of projectFiles) {
    if (file === definingFile) continue
    let src = fileCache.get(file)
    if (src === undefined) {
      try { src = fs.readFileSync(file, 'utf8') } catch { src = '' }
      fileCache.set(file, src)
    }
    if (!wordRe.test(src)) continue
    const stripped = staticStripComments(src)
    if (!wordRe.test(stripped)) continue

    const isTypeOnly = typeImportRe.test(stripped)
    const isReExport = reExportRe.test(stripped)

    // Count an import-only-as-type or only a barrel re-export specially.
    // If the same file also has a real, non-type, non-re-export reference,
    // that wins.
    const cleanedForRealUse = stripped
      .replace(/import\s+type\s*\{[^}]*\}\s*from\s*[^;\n]+/g, ' ')
      .replace(/export\s*\{[^}]*\}\s*from\s*[^;\n]+/g, ' ')
    const hasRealUsage = wordRe.test(cleanedForRealUse)

    if (hasRealUsage) {
      if (staticIsTestFile(file)) usages.test.push(file)
      else usages.userFlow.push(file)
    } else if (isReExport) {
      usages.reExport.push(file)
    } else if (isTypeOnly) {
      usages.typeOnly.push(file)
    }
  }
  return usages
}

function staticCountInternalUsages(symbol, file, fileCache) {
  let src = fileCache.get(file)
  if (src === undefined) {
    try { src = fs.readFileSync(file, 'utf8') } catch { src = '' }
    fileCache.set(file, src)
  }
  // Strip comments + intra-file type-only imports / re-exports so we count
  // only real intra-file references.
  const cleaned = staticStripComments(src)
    .replace(/import\s+type\s*\{[^}]*\}\s*from\s*[^;\n]+/g, ' ')
    .replace(/export\s*\{[^}]*\}\s*from\s*[^;\n]+/g, ' ')
  const re = new RegExp(`(?<![A-Za-z0-9_$])${staticEscapeRe(symbol)}(?![A-Za-z0-9_$])`, 'g')
  let count = 0
  while (re.exec(cleaned) !== null) count++
  // Subtract one for the declaration itself.
  return Math.max(0, count - 1)
}

function staticClassifyExport(exp, usages, internalCount) {
  const ann = exp.annotation || null

  // Annotation handling first — invalid/expired must not pass.
  if (ann) {
    if (ann.status === 'INVALID') {
      return { classification: 'INVALID_KEEP_ANNOTATION', confidence: 'HIGH' }
    }
    if (ann.status === 'EXPIRED') {
      return { classification: 'MANUAL_REVIEW_EXPIRED_KEEP', confidence: 'MEDIUM' }
    }
    // status === 'VALID' falls through; real usage still wins for non-TEST_ONLY,
    // but TEST_ONLY without test usage is surfaced as TEST_ONLY_EXPLICIT
    // (medium) so it cannot silently mask missing evidence.
    if (ann.kind === 'TEST_ONLY') {
      if (usages.test.length > 0) return { classification: 'PROVEN_USED_IN_TEST', confidence: 'HIGH' }
      return { classification: 'TEST_ONLY_EXPLICIT', confidence: 'MEDIUM' }
    }
  }

  if (exp.testOnly) return { classification: 'TEST_ONLY_EXPLICIT', confidence: 'HIGH' }
  if (usages.userFlow.length > 0) return { classification: 'PROVEN_USED_IN_USER_FLOW', confidence: 'HIGH' }
  if (usages.test.length > 0) return { classification: 'PROVEN_USED_IN_TEST', confidence: 'HIGH' }

  // Annotation only fills in for symbols that would otherwise be unreachable.
  if (ann && ann.status === 'VALID') {
    if (ann.kind === 'FUTURE_API') return { classification: 'INTENTIONAL_KEEP_FUTURE_API', confidence: 'MEDIUM' }
    if (ann.kind === 'KEEP') return { classification: 'INTENTIONAL_KEEP', confidence: 'MEDIUM' }
    if (ann.kind === 'DYNAMIC_USAGE') return { classification: 'DYNAMIC_USAGE_DECLARED', confidence: 'MEDIUM' }
  }

  if (usages.reExport.length > 0) return { classification: 'MANUAL_REVIEW_DYNAMIC_USAGE', confidence: 'MEDIUM' }
  if (usages.typeOnly.length > 0) return { classification: 'MANUAL_REVIEW_DYNAMIC_USAGE', confidence: 'MEDIUM' }
  if (internalCount > 0) return { classification: 'USED_IN_DEFINING_FILE_ONLY', confidence: 'HIGH' }
  return { classification: 'NOT_PROVEN_NO_USAGE', confidence: 'HIGH' }
}

function runStaticAnalysis(packCfg) {
  const allowed = packCfg && packCfg.allowedPaths ? packCfg.allowedPaths : []
  const projectFiles = []
  for (const root of STATIC_PROJECT_ROOTS) projectFiles.push(...staticWalkFiles(root))
  const definingFiles = projectFiles.filter(
    (f) => staticIsWithinPackAllowed(f, allowed) && !staticIsTestFile(f),
  )

  const fileCache = new Map()
  const symbols = []
  for (const f of definingFiles) {
    let src = fileCache.get(f)
    if (src === undefined) {
      try { src = fs.readFileSync(f, 'utf8') } catch { src = '' }
      fileCache.set(f, src)
    }
    const exps = staticExtractExports(f, src)
    for (const exp of exps) {
      const usages = staticFindUsages(exp.name, exp.file, projectFiles, fileCache)
      const internalCount = staticCountInternalUsages(exp.name, exp.file, fileCache)
      const cls = staticClassifyExport(exp, usages, internalCount)
      const ann = exp.annotation || null
      const recommendation = cls.classification === 'USED_IN_DEFINING_FILE_ONLY'
        ? 'Live at runtime via intra-file calls. Exported API surface may be unnecessary; consider de-exporting if not needed by external code or tests.'
        : cls.classification === 'NOT_PROVEN_NO_USAGE'
        ? 'No reference outside the defining file. Likely dead code; review for removal.'
        : cls.classification === 'MANUAL_REVIEW_DYNAMIC_USAGE'
        ? 'Only seen via barrel re-export or type-only import. Manual review required.'
        : cls.classification === 'INVALID_KEEP_ANNOTATION'
        ? `@workbench-keep annotation is malformed: ${(ann && ann.errors || []).join(', ')}. Fix the annotation or remove the symbol.`
        : cls.classification === 'MANUAL_REVIEW_EXPIRED_KEEP'
        ? `@workbench-keep reviewAfter (${ann ? ann.reviewAfter : '?'}) is in the past. Re-confirm intent or remove the symbol.`
        : cls.classification === 'INTENTIONAL_KEEP_FUTURE_API'
        ? 'Marked as future API by an explicit @workbench-keep FUTURE_API annotation. Surface for human review; does not count as user-flow proof.'
        : cls.classification === 'INTENTIONAL_KEEP'
        ? 'Marked as intentionally kept by an explicit @workbench-keep KEEP annotation. Surface for human review; does not count as user-flow proof.'
        : cls.classification === 'DYNAMIC_USAGE_DECLARED'
        ? 'Marked as dynamically used by an explicit @workbench-keep DYNAMIC_USAGE annotation. Surface for human review; does not count as user-flow proof.'
        : null
      symbols.push({
        name: exp.name,
        kind: exp.kind,
        definingFile: exp.file,
        line: exp.line,
        testOnly: exp.testOnly,
        definingFileInternalUsages: internalCount,
        externalUsages: usages.userFlow,
        testUsages: usages.test,
        usageFiles: {
          userFlow: usages.userFlow,
          test: usages.test,
          reExportOnly: usages.reExport,
          typeOnly: usages.typeOnly,
        },
        classification: cls.classification,
        confidence: cls.confidence,
        annotationKind: ann ? ann.kind : null,
        annotationReason: ann ? ann.reason : null,
        annotationOwner: ann ? ann.owner : null,
        annotationReviewAfter: ann ? ann.reviewAfter : null,
        annotationStatus: ann ? ann.status : null,
        annotationErrors: ann ? ann.errors : null,
        recommendation,
      })
    }
  }

  const counts = {
    PROVEN_USED_IN_USER_FLOW: 0,
    PROVEN_USED_IN_TEST: 0,
    TEST_ONLY_EXPLICIT: 0,
    USED_IN_DEFINING_FILE_ONLY: 0,
    MANUAL_REVIEW_DYNAMIC_USAGE: 0,
    INTENTIONAL_KEEP_FUTURE_API: 0,
    INTENTIONAL_KEEP: 0,
    DYNAMIC_USAGE_DECLARED: 0,
    MANUAL_REVIEW_EXPIRED_KEEP: 0,
    INVALID_KEEP_ANNOTATION: 0,
    NOT_PROVEN_NO_USAGE: 0,
  }
  for (const s of symbols) counts[s.classification] = (counts[s.classification] || 0) + 1

  return {
    workbenchVersion: WORKBENCH_VERSION,
    packAllowedPaths: allowed,
    scannedDefiningFiles: definingFiles.map((f) => f.replace(/\\/g, '/')),
    scannedProjectFileCount: projectFiles.length,
    exportedSymbols: symbols.length,
    counts,
    symbols,
    note: 'Conservative regex-based reachability scan. Internal-only exports (USED_IN_DEFINING_FILE_ONLY) are alive at runtime but the export keyword may be unnecessary. Type-only imports and barrel re-exports trigger MANUAL_REVIEW_DYNAMIC_USAGE. NOT_PROVEN_NO_USAGE means no reference anywhere outside the defining file and not even an intra-file usage.',
  }
}

function applyStaticAnalysisToEvals(evalResults, sa) {
  const dead = sa.symbols.filter((s) => s.classification === 'NOT_PROVEN_NO_USAGE')
  const internal = sa.symbols.filter((s) => s.classification === 'USED_IN_DEFINING_FILE_ONLY')
  const dynamic = sa.symbols.filter((s) => s.classification === 'MANUAL_REVIEW_DYNAMIC_USAGE')
  const invalidKeep = sa.symbols.filter((s) => s.classification === 'INVALID_KEEP_ANNOTATION')
  const expiredKeep = sa.symbols.filter((s) => s.classification === 'MANUAL_REVIEW_EXPIRED_KEEP')
  const intentionalKeep = sa.symbols.filter((s) =>
    s.classification === 'INTENTIONAL_KEEP_FUTURE_API' ||
    s.classification === 'INTENTIONAL_KEEP' ||
    s.classification === 'DYNAMIC_USAGE_DECLARED'
  )
  const fmt = (s) => `${s.name} @ ${s.definingFile.replace(/\\/g, '/')}:${s.line}`

  for (const e of evalResults) {
    if (e.id === 'integration-dead-code') {
      e.command = 'workbench static-analysis (regex reachability + intent annotations)'
      e.exitCode = null
      if (invalidKeep.length > 0) {
        e.status = 'FAILED'
        e.confidence = 'HIGH'
        e.reason = 'INVALID_KEEP_ANNOTATION'
        e.evidenceSummary = `Found ${invalidKeep.length} malformed @workbench-keep annotation(s): ` +
          invalidKeep.slice(0, 10).map((s) => `${fmt(s)} [${(s.annotationErrors || []).join(',')}]`).join(', ')
      } else if (dead.length === 0) {
        e.status = 'PROVEN'
        e.confidence = 'HIGH'
        e.reason = 'NO_DEAD_CODE_DETECTED'
        e.evidenceSummary = `Static analysis scanned ${sa.scannedDefiningFiles.length} defining files and found 0 NOT_PROVEN_NO_USAGE exports across ${sa.exportedSymbols} symbols. ` +
          `${internal.length} internal-only, ${dynamic.length} dynamic-usage, ${intentionalKeep.length} intentional-keep, ${expiredKeep.length} expired-keep — surfaced for review but not counted as dead.`
      } else {
        e.status = 'FAILED'
        e.confidence = 'HIGH'
        e.reason = 'DEAD_CODE_DETECTED'
        e.evidenceSummary = `Found ${dead.length} unused export(s): ` + dead.slice(0, 15).map(fmt).join(', ') + (dead.length > 15 ? `, …(+${dead.length - 15} more)` : '')
      }
    } else if (e.id === 'real-call-site-validation') {
      e.command = 'workbench static-analysis (regex reachability + intent annotations)'
      e.exitCode = null
      if (invalidKeep.length > 0) {
        e.status = 'FAILED'
        e.confidence = 'HIGH'
        e.reason = 'INVALID_KEEP_ANNOTATION'
        e.evidenceSummary = `Found ${invalidKeep.length} malformed @workbench-keep annotation(s): ` +
          invalidKeep.slice(0, 10).map((s) => `${fmt(s)} [${(s.annotationErrors || []).join(',')}]`).join(', ')
      } else if (dead.length === 0 && dynamic.length === 0 && internal.length === 0 && intentionalKeep.length === 0 && expiredKeep.length === 0) {
        e.status = 'PROVEN'
        e.confidence = 'HIGH'
        e.reason = 'ALL_EXPORTS_REACHABLE'
        e.evidenceSummary = `All ${sa.exportedSymbols} exported symbols in pack-allowed paths have external user-flow or test usage (or are explicitly test-only).`
      } else if (dead.length > 0) {
        e.status = 'FAILED'
        e.confidence = 'HIGH'
        e.reason = 'UNREACHABLE_EXPORTS'
        e.evidenceSummary = `Found ${dead.length} unreachable export(s): ` + dead.slice(0, 10).map(fmt).join(', ')
      } else {
        // No truly unreachable exports, but some live only via barrel/type-only
        // imports, only inside their defining file, or only via an explicit
        // @workbench-keep annotation. Surface as MANUAL_REVIEW.
        e.status = 'MANUAL_REVIEW'
        e.confidence = 'MEDIUM'
        let reason
        if (intentionalKeep.length > 0 || expiredKeep.length > 0) reason = 'INTENTIONAL_KEEP_PRESENT'
        else if (internal.length > 0) reason = 'EXPORT_API_REVIEW'
        else reason = 'DYNAMIC_USAGE_DETECTED'
        e.reason = reason
        const parts = []
        if (intentionalKeep.length > 0) {
          parts.push(`${intentionalKeep.length} intentional-keep export(s) — surviving via @workbench-keep annotation only: ` +
            intentionalKeep.slice(0, 6).map((s) => `${fmt(s)} [${s.annotationKind}]`).join(', ') +
            (intentionalKeep.length > 6 ? ` …(+${intentionalKeep.length - 6} more)` : ''))
        }
        if (expiredKeep.length > 0) {
          parts.push(`${expiredKeep.length} expired @workbench-keep annotation(s): ` +
            expiredKeep.slice(0, 6).map((s) => `${fmt(s)} [reviewAfter=${s.annotationReviewAfter}]`).join(', '))
        }
        if (internal.length > 0) {
          parts.push(`${internal.length} internal-only export(s): ` +
            internal.slice(0, 6).map(fmt).join(', ') + (internal.length > 6 ? ` …(+${internal.length - 6} more)` : ''))
        }
        if (dynamic.length > 0) {
          parts.push(`${dynamic.length} dynamic-usage export(s) — only via barrel/type-only: ` +
            dynamic.slice(0, 6).map(fmt).join(', ') + (dynamic.length > 6 ? ` …(+${dynamic.length - 6} more)` : ''))
        }
        e.evidenceSummary = parts.join(' | ')
      }
    }
  }
}

function writeJSON(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2))
}

// v0.3.1 self-test: validates the @workbench-keep annotation parser and
// classifier against in-memory fixture strings. Does not touch product code.
// Writes annotation-self-test.json into the run directory.
function runAnnotationSelfTest() {
  const futureISO = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const pastISO = '2020-01-01'

  const cases = [
    {
      id: 'valid-future-api',
      fixture: [
        '/**',
        ' * @workbench-keep FUTURE_API',
        ' * reason: planned API for the upcoming reminder surface',
        ' * owner: leo',
        ` * reviewAfter: ${futureISO}`,
        ' */',
        'export function plannedHelper() {}',
      ],
      expectStatus: 'VALID',
      expectKind: 'FUTURE_API',
      expectClassificationNoUsage: 'INTENTIONAL_KEEP_FUTURE_API',
    },
    {
      id: 'malformed-missing-reason',
      fixture: [
        '/**',
        ' * @workbench-keep FUTURE_API',
        ' * owner: leo',
        ` * reviewAfter: ${futureISO}`,
        ' */',
        'export function noReasonHelper() {}',
      ],
      expectStatus: 'INVALID',
      expectErrorIncludes: 'MISSING_REASON',
      expectClassificationNoUsage: 'INVALID_KEEP_ANNOTATION',
    },
    {
      id: 'invalid-kind-frozen',
      fixture: [
        '/**',
        ' * @workbench-keep FROZEN',
        ' * reason: trying an unknown kind',
        ' * owner: leo',
        ` * reviewAfter: ${futureISO}`,
        ' */',
        'export function frozenHelper() {}',
      ],
      expectStatus: 'INVALID',
      expectErrorIncludes: 'INVALID_KIND',
      expectClassificationNoUsage: 'INVALID_KEEP_ANNOTATION',
    },
    {
      id: 'expired-review-after',
      fixture: [
        '/**',
        ' * @workbench-keep KEEP',
        ' * reason: kept for legacy compatibility',
        ' * owner: leo',
        ` * reviewAfter: ${pastISO}`,
        ' */',
        'export function expiredHelper() {}',
      ],
      expectStatus: 'EXPIRED',
      expectClassificationNoUsage: 'MANUAL_REVIEW_EXPIRED_KEEP',
    },
    {
      id: 'annotation-does-not-imply-user-flow-proof',
      fixture: [
        '/**',
        ' * @workbench-keep FUTURE_API',
        ' * reason: not yet wired to UI',
        ' * owner: leo',
        ` * reviewAfter: ${futureISO}`,
        ' */',
        'export function unwiredHelper() {}',
      ],
      // No external usages; classifier must NOT return PROVEN_USED_IN_USER_FLOW.
      expectStatus: 'VALID',
      expectKind: 'FUTURE_API',
      expectClassificationNoUsage: 'INTENTIONAL_KEEP_FUTURE_API',
      assertNotUserFlowProof: true,
    },
  ]

  const results = []
  for (const c of cases) {
    const lines = c.fixture
    // The export line is the last fixture line.
    const exportIdx = lines.length - 1
    const ann = staticExtractKeepAnnotation(lines, exportIdx)
    const exp = {
      name: 'fixture',
      kind: 'function',
      file: '<self-test>',
      line: exportIdx + 1,
      testOnly: false,
      annotation: ann,
    }
    const usages = { userFlow: [], test: [], reExport: [], typeOnly: [] }
    const cls = staticClassifyExport(exp, usages, 0)

    const checks = []
    let passed = true
    const expect = (label, ok) => { checks.push({ label, ok }); if (!ok) passed = false }

    expect('annotation parsed', ann !== null)
    if (ann) expect(`status=${c.expectStatus}`, ann.status === c.expectStatus)
    if (c.expectKind) expect(`kind=${c.expectKind}`, ann && ann.kind === c.expectKind)
    if (c.expectErrorIncludes) expect(`errors include ${c.expectErrorIncludes}`,
      ann && Array.isArray(ann.errors) && ann.errors.includes(c.expectErrorIncludes))
    expect(`classification=${c.expectClassificationNoUsage}`, cls.classification === c.expectClassificationNoUsage)
    if (c.assertNotUserFlowProof) {
      expect('classification != PROVEN_USED_IN_USER_FLOW', cls.classification !== 'PROVEN_USED_IN_USER_FLOW')
    }

    results.push({
      id: c.id,
      passed,
      annotation: ann,
      classification: cls.classification,
      checks,
    })
  }

  const allPassed = results.every((r) => r.passed)
  return {
    workbenchVersion: WORKBENCH_VERSION,
    allPassed,
    totalCases: results.length,
    passedCases: results.filter((r) => r.passed).length,
    results,
  }
}

// ─── v0.4 review/repair loop ──────────────────────────────────────────────
// All v0.4 helpers are pure functions of their inputs. They are exercised by
// the self-test in runV04SelfTest() with synthetic fixtures, and again from
// main() with real run data.

const REPO_MISMATCH_MARKERS = ['zero2026', 'Dictator', 'ActionDock', 'FactionRail', 'ZeroGameScreen']

function detectRepoMismatch({ task, projectRoot }) {
  const matched = []
  for (const m of REPO_MISMATCH_MARKERS) {
    const re = new RegExp(`(?<![A-Za-z0-9_])${m}(?![A-Za-z0-9_])`, 'i')
    if (re.test(task)) matched.push(m)
  }
  // Path-mention extraction: simple "src/<word>/..." references in task.
  const pathMentions = []
  const pathRe = /(?:^|\s|`)(src\/[A-Za-z0-9_\-\/.]+\.(?:ts|tsx|js|jsx|css|json|md))/g
  let match
  while ((match = pathRe.exec(task)) !== null) pathMentions.push(match[1])
  const missingPathMentions = pathMentions.filter((p) => {
    try { return !fs.existsSync(path.join(projectRoot, p)) } catch { return true }
  })

  // Repo identity hints.
  const hasAbuAI = (() => { try { return fs.existsSync(path.join(projectRoot, 'src/screens/AbuAI')) } catch { return false } })()
  const hasAbuCalendar = (() => { try { return fs.existsSync(path.join(projectRoot, 'src/screens/AbuCalendar')) } catch { return false } })()
  const isAbuBank = hasAbuAI || hasAbuCalendar

  if (matched.length > 0 && isAbuBank) {
    return {
      status: 'STOP_REPO_MISMATCH',
      confidence: 'HIGH',
      recommendedAction: 'NO_EDIT',
      matchedMarkers: matched,
      missingPathMentions,
      repoIdentity: 'AbuBank',
      reason: `Task references unrelated project markers (${matched.join(', ')}); current repo is AbuBank. Refusing to edit.`,
    }
  }
  return {
    status: 'OK',
    confidence: missingPathMentions.length > 0 ? 'MEDIUM' : 'HIGH',
    recommendedAction: 'PROCEED',
    matchedMarkers: matched,
    missingPathMentions,
    repoIdentity: isAbuBank ? 'AbuBank' : 'unknown',
    reason: matched.length > 0
      ? `Markers found (${matched.join(', ')}) but repo identity unclear; no STOP triggered.`
      : (missingPathMentions.length > 0
        ? `Some referenced paths do not exist: ${missingPathMentions.slice(0, 3).join(', ')}. Proceed with caution.`
        : 'No mismatch detected.'),
  }
}

function buildDiffSummary({ regression, gitStatusRaw }) {
  const parsed = regression && regression.parsed ? regression.parsed : []
  const buckets = (regression && regression.buckets) || {}
  const changedFiles = parsed.map((p) => p.path)
  const addedFiles = parsed.filter((p) => /^\?\?|^A/.test(p.code || '')).map((p) => p.path)
  const deletedFiles = parsed.filter((p) => /D/.test(p.code || '')).map((p) => p.path)
  const modifiedFiles = parsed.filter((p) => /M/.test(p.code || '')).map((p) => p.path)
  const isPackage = (f) => /^package(-lock)?\.json$/.test(f)
  const isEnv = (f) => /^\.env(\..+)?$/.test(f)
  const isDocs = (f) => /^docs\//.test(f) || /^README/i.test(f) || /\.md$/.test(f)
  const isTest = (f) => /\.(test|spec)\.[a-z]+$/.test(f) || /^tests?\//.test(f)
  const summaryByPath = parsed.map((p) => ({ path: p.path, code: p.code }))
  return {
    workbenchVersion: WORKBENCH_VERSION,
    gitStatusShort: gitStatusRaw || '',
    changedFiles,
    addedFiles,
    deletedFiles,
    modifiedFiles,
    generatedFiles: buckets.generatedFiles || [],
    productFiles: buckets.allowedPaths || [],
    workbenchFiles: buckets.workbenchInfra || [],
    forbiddenFiles: buckets.forbiddenPaths || [],
    packageFiles: changedFiles.filter(isPackage),
    envFiles: changedFiles.filter(isEnv),
    docsFiles: changedFiles.filter(isDocs),
    testFiles: changedFiles.filter(isTest),
    summaryByPath,
    lineStats: null,
  }
}

function buildDecisionRequired({ staticAnalysis, repoMismatch }) {
  const decisions = []
  if (repoMismatch && repoMismatch.status === 'STOP_REPO_MISMATCH') {
    decisions.push({
      id: 'repo-mismatch',
      type: 'REPO_MISMATCH',
      status: 'OPEN',
      summary: repoMismatch.reason,
      options: ['NO_EDIT — confirm wrong repo', 'PROCEED — explicitly authorize despite markers'],
      recommendation: 'NO_EDIT',
      risk: 'Editing this repo on a task aimed at another project would corrupt unrelated code.',
      owner: 'leo',
      reviewAfter: null,
      blocksAutoApproval: true,
    })
  }
  if (staticAnalysis && Array.isArray(staticAnalysis.symbols)) {
    const dead = staticAnalysis.symbols.filter((s) => s.classification === 'NOT_PROVEN_NO_USAGE')
    const stitch = dead.filter((s) => /\/stitch\.ts$/.test(s.definingFile))
    if (stitch.length > 0) {
      decisions.push({
        id: 'stitch-module',
        type: 'CLEANUP',
        status: 'OPEN',
        summary: `${stitch.length} unused export(s) in src/services/stitch.ts: ${stitch.map((s) => s.name).join(', ')}. The Stitch surface includes a Vite dev-proxy plugin and an npm dep (@google/stitch-sdk).`,
        options: [
          'DELETE_MODULE — remove src/services/stitch.ts + stitchProxyPlugin in vite.config.ts + @google/stitch-sdk dep + discovery doc line (HUMAN_APPROVAL_REQUIRED)',
          'FUTURE_API_ANNOTATE — add @workbench-keep FUTURE_API to all three exports with reason naming the SDK + proxy entanglement',
          'MANUAL_REVIEW — leave flagged until human roadmap input',
        ],
        recommendation: 'MANUAL_REVIEW',
        risk: 'Annotating only client-side exports masks the live server scaffolding from future audits; deleting requires touching package.json/lock + vite.config.ts (out of pack scope).',
        owner: 'leo',
        reviewAfter: null,
        blocksAutoApproval: true,
      })
    }
    const voiceCues = dead.filter((s) => /\/sounds\.ts$/.test(s.definingFile) && /^sound(VoiceStart|VoiceEnd|SpeakStart)$/.test(s.name))
    if (voiceCues.length > 0) {
      decisions.push({
        id: 'sound-voice-cues',
        type: 'CLEANUP',
        status: 'OPEN',
        summary: `${voiceCues.length} unused voice-cue export(s) in src/services/sounds.ts: ${voiceCues.map((s) => s.name).join(', ')}. AbuAI voice path does not currently call these.`,
        options: [
          'FUTURE_API — annotate all three together if voice UX is planned to gain audible cues',
          'DELETE — remove if voice UX is redesigned without audible cues',
          'MANUAL_REVIEW — leave flagged until human roadmap input',
        ],
        recommendation: 'MANUAL_REVIEW',
        risk: 'Annotation without a real plan masks dead code; deletion without checking loses cue primitives.',
        owner: 'leo',
        reviewAfter: null,
        blocksAutoApproval: true,
      })
    }
    const otherSounds = dead.filter((s) => /\/sounds\.ts$/.test(s.definingFile) && !/^sound(VoiceStart|VoiceEnd|SpeakStart)$/.test(s.name))
    for (const s of otherSounds) {
      decisions.push({
        id: `sound-${s.name}`,
        type: 'CLEANUP',
        status: 'OPEN',
        summary: `Unused export ${s.name} at ${s.definingFile}:${s.line}.`,
        options: ['FUTURE_API_ANNOTATE', 'DELETE', 'MANUAL_REVIEW'],
        recommendation: 'MANUAL_REVIEW',
        risk: 'Decision depends on whether matching UX is planned.',
        owner: 'leo',
        reviewAfter: null,
        blocksAutoApproval: true,
      })
    }
    const stream = dead.find((s) => s.name === 'streamSpeakVoiceMode')
    if (stream) {
      decisions.push({
        id: 'streamSpeakVoiceMode',
        type: 'ARCHITECTURE',
        status: 'OPEN',
        summary: `Unused 50+ line streaming TTS entry point at ${stream.definingFile}:${stream.line}. Live voice path uses realtimeVoice/non-streaming TTS.`,
        options: [
          'FUTURE_API_ANNOTATE — if streaming TTS is on the roadmap',
          'DELETE — if superseded by realtimeVoice',
          'MANUAL_REVIEW — until human roadmap input',
        ],
        recommendation: 'MANUAL_REVIEW',
        risk: 'Premature delete loses non-trivial implementation; premature annotate masks dead code.',
        owner: 'leo',
        reviewAfter: null,
        blocksAutoApproval: true,
      })
    }
  }
  return { workbenchVersion: WORKBENCH_VERSION, decisions }
}

function buildNextAction({ task, finalStatus, finalReason, diffSummary, repoMismatch, evalCounts, anyFailed, annotationSelfTest, v04SelfTest, branchName }) {
  const blockers = []
  const filesToAdd = []
  let recommendedAction = 'NO_ACTION'
  let confidence = 'LOW'
  let reason = ''
  let allowedGitActions = []
  // Forbidden actions are constant across recommendations: never main, never
  // merge, never force-push, never stage memory/* or .ai-runs/*.
  let forbiddenGitActions = [
    'git push origin main',
    'git push --force',
    'git push origin master',
    'git merge',
    'git reset --hard',
    'git add memory/*',
    'git add .ai-runs/*',
  ]
  let requiresHumanApproval = true
  let commitMessage = null
  const whatLeoShouldNotSend = []

  const branch = branchName || '<feature-branch>'
  // Files outside (workbench + generated) — anything else is suspicious.
  const knownInfraOrGenerated = new Set([...(diffSummary.workbenchFiles || []), ...(diffSummary.generatedFiles || [])])
  const unexpectedDirty = (diffSummary.changedFiles || []).filter((f) => !knownInfraOrGenerated.has(f) && !/^\.ai-runs\//.test(f))
  const hasRunsInDiff = (diffSummary.changedFiles || []).some((f) => /^\.ai-runs\//.test(f))
  const allChangedAreWorkbenchInfraOrGenerated = diffSummary.changedFiles.length > 0 &&
    unexpectedDirty.length === 0 &&
    !hasRunsInDiff &&
    diffSummary.workbenchFiles.length > 0
  const selfTestsGreen = (!annotationSelfTest || annotationSelfTest.allPassed !== false) &&
    (!v04SelfTest || v04SelfTest.allPassed !== false)

  if (repoMismatch && repoMismatch.status === 'STOP_REPO_MISMATCH') {
    recommendedAction = 'STOP_REPO_MISMATCH'
    confidence = 'HIGH'
    reason = repoMismatch.reason
    blockers.push('REPO_MISMATCH')
    whatLeoShouldNotSend.push('any commit/push/merge instruction in this repo for this task')
  } else if (diffSummary.forbiddenFiles.length > 0) {
    recommendedAction = 'REVERT'
    confidence = 'HIGH'
    reason = `Forbidden path(s) touched: ${diffSummary.forbiddenFiles.join(', ')}.`
    blockers.push('FORBIDDEN_PATH_TOUCHED')
  } else if (diffSummary.envFiles.length > 0) {
    recommendedAction = 'MANUAL_REVIEW'
    confidence = 'HIGH'
    reason = `.env file(s) modified: ${diffSummary.envFiles.join(', ')}. Secrets/configuration require human approval.`
    blockers.push('ENV_FILE_TOUCHED')
  } else if (diffSummary.packageFiles.length > 0) {
    recommendedAction = 'MANUAL_REVIEW'
    confidence = 'HIGH'
    reason = `package.json/package-lock.json modified: ${diffSummary.packageFiles.join(', ')}. HUMAN_APPROVAL_REQUIRED.`
    blockers.push('PACKAGE_FILE_TOUCHED')
    requiresHumanApproval = true
  } else if (diffSummary.changedFiles.length === 0) {
    recommendedAction = 'NO_ACTION'
    confidence = 'HIGH'
    reason = 'Working tree is clean; nothing to commit.'
  } else if (anyFailed) {
    recommendedAction = 'REQUEST_REPAIR'
    confidence = 'HIGH'
    reason = 'Validation failed (typecheck/test/build). See repair-prompt.md.'
    blockers.push('VALIDATION_FAILED')
  } else if (!selfTestsGreen) {
    recommendedAction = 'REQUEST_REPAIR'
    confidence = 'HIGH'
    reason = 'Workbench self-test (annotation or v0.4) failed. See repair-prompt.md.'
    blockers.push('SELF_TEST_FAILED')
  } else if (hasRunsInDiff) {
    recommendedAction = 'MANUAL_REVIEW'
    confidence = 'HIGH'
    reason = '.ai-runs/* present in working tree; revert before commit.'
    blockers.push('AI_RUNS_FILES_PRESENT')
  } else if (diffSummary.productFiles.length > 0) {
    // Product files changed in allowed paths, validation green. Even if the
    // run's finalStatus is FAILED for a known static-analysis backlog, it is
    // safe to recommend committing the actual changed files only.
    recommendedAction = 'COMMIT_FEATURE_BRANCH'
    confidence = finalStatus === 'PROVEN' ? 'HIGH' : 'MEDIUM'
    reason = finalStatus === 'PROVEN'
      ? 'Validation green, regression clean, evidence PROVEN.'
      : 'Validation green and regression clean; finalStatus may still be FAILED for an unrelated static-analysis backlog. Commit only the listed allowed-path files.'
    allowedGitActions = [
      'git add ' + diffSummary.productFiles.map((f) => `"${f}"`).join(' '),
      'git commit',
      `git push origin ${branch}`,
    ]
    filesToAdd.push(...diffSummary.productFiles)
    requiresHumanApproval = true
    if (diffSummary.generatedFiles.length > 0) whatLeoShouldNotSend.push(`do not include ${diffSummary.generatedFiles.join(', ')} (auto-generated)`)
  } else if (allChangedAreWorkbenchInfraOrGenerated) {
    // Workbench-infrastructure-only real diff (e.g. scripts/ai-workbench.js).
    // memory/* may also appear in generatedFiles because npm run build
    // regenerated them during this run; those must NOT be committed.
    // Validation, both self-tests, and repo-mismatch are green at this point.
    recommendedAction = 'COMMIT_FEATURE_BRANCH'
    confidence = 'HIGH'
    reason = 'Workbench infrastructure change validated; product unresolved backlog remains and is not solved by this commit.'
    allowedGitActions = [
      'git add ' + diffSummary.workbenchFiles.map((f) => `"${f}"`).join(' '),
      'git commit',
      `git push origin ${branch}`,
    ]
    filesToAdd.push(...diffSummary.workbenchFiles)
    requiresHumanApproval = true
    if (diffSummary.generatedFiles.length > 0) {
      whatLeoShouldNotSend.push(`do not include ${diffSummary.generatedFiles.join(', ')} (auto-regenerated by prebuild; revert with git checkout before commit)`)
    }
  } else {
    recommendedAction = 'MANUAL_REVIEW'
    confidence = 'LOW'
    reason = `finalStatus=${finalStatus} / finalReason=${finalReason}; no clear automated action.`
  }

  return {
    workbenchVersion: WORKBENCH_VERSION,
    recommendedAction,
    confidence,
    reason,
    allowedGitActions,
    forbiddenGitActions,
    filesToAdd,
    commitMessage,
    requiresHumanApproval,
    blockers,
    copyPasteReduction: {
      whatLeoShouldSendNext: recommendedAction === 'STOP_REPO_MISMATCH'
        ? 'Re-route the task to the correct repository.'
        : recommendedAction === 'COMMIT_FEATURE_BRANCH'
          ? `Authorize: git add ${filesToAdd.join(' ')}; git commit; git push origin <feature-branch>. Do NOT include memory/* or .ai-runs/*.`
          : recommendedAction === 'REQUEST_REPAIR'
            ? 'Paste repair-prompt.md into Claude Code. Do NOT commit until validation passes.'
            : recommendedAction === 'NO_ACTION'
              ? 'Working tree is clean. No further action required for this run.'
              : 'Review evidence-check.json and decide manually.',
      whatLeoShouldNotSend,
    },
  }
}

function buildReviewPrompt({ task, pack, runDir, finalStatus, finalReason, diffSummary, validationSummary, evalCounts, staticAnalysis, regression, safetyStatus, truthFlagged, repoMismatch, decisionRequired, nextAction }) {
  const recommendedDecision = (() => {
    if (repoMismatch && repoMismatch.status === 'STOP_REPO_MISMATCH') return 'STOP_REPO_MISMATCH'
    if (nextAction.recommendedAction === 'COMMIT_FEATURE_BRANCH') return 'APPROVE_COMMIT'
    if (nextAction.recommendedAction === 'REQUEST_REPAIR') return 'REQUEST_REPAIR'
    if (nextAction.recommendedAction === 'REVERT') return 'REVERT'
    return 'MANUAL_REVIEW'
  })()
  const validationLines = validationSummary.map((v) => `- npm run ${v.name} — ${v.status}${v.code !== null && v.code !== undefined ? ` (exit ${v.code})` : ''}`).join('\n')
  const saCounts = (staticAnalysis && staticAnalysis.counts) || {}
  return `# Workbench v${WORKBENCH_VERSION} — Reviewer Packet

## Task
${task}

## Pack
${pack}

## Run folder
${runDir}

## finalStatus / finalReason
- finalStatus: ${finalStatus}
- finalReason: ${finalReason}

## Changed files
${diffSummary.changedFiles.length === 0 ? '(clean tree)' : diffSummary.changedFiles.map((f) => '- ' + f).join('\n')}

### Bucketing
- product (allowed paths): ${diffSummary.productFiles.length} → ${diffSummary.productFiles.join(', ') || '(none)'}
- workbench infra: ${diffSummary.workbenchFiles.length} → ${diffSummary.workbenchFiles.join(', ') || '(none)'}
- generated (auto, do not commit): ${diffSummary.generatedFiles.length} → ${diffSummary.generatedFiles.join(', ') || '(none)'}
- forbidden: ${diffSummary.forbiddenFiles.length} → ${diffSummary.forbiddenFiles.join(', ') || '(none)'}
- package files: ${diffSummary.packageFiles.length} → ${diffSummary.packageFiles.join(', ') || '(none)'}
- env/secrets: ${diffSummary.envFiles.length} → ${diffSummary.envFiles.join(', ') || '(none)'}

## Validation
${validationLines || '(no validation scripts available)'}

## Eval summary
- total: ${evalCounts.total}
- PROVEN: ${evalCounts.proven}
- NOT_PROVEN: ${evalCounts.notProven}
- MANUAL_REVIEW: ${evalCounts.manualReview}
- FAILED: ${evalCounts.failed}

## Static analysis
- exportedSymbols: ${staticAnalysis ? staticAnalysis.exportedSymbols : '?'}
- counts: ${JSON.stringify(saCounts)}

## Regression
- status: ${regression.status}${regression.issues && regression.issues.length ? ' — ' + regression.issues.join(', ') : ''}
- changed files: ${regression.changed ?? 'n/a'}

## Safety
- ${safetyStatus}

## Truth violations
- pre-final matchCount: ${truthFlagged.length}

## Generated files that must not be committed
${diffSummary.generatedFiles.length === 0 ? '(none)' : diffSummary.generatedFiles.map((f) => '- ' + f).join('\n')}

## Unresolved decisions
${decisionRequired.decisions.length === 0 ? '(none)' : decisionRequired.decisions.map((d) => `- [${d.type}] ${d.id} — ${d.summary} (recommendation: ${d.recommendation})`).join('\n')}

## Recommended reviewer decision
${recommendedDecision}

## Question for reviewer
"Should this be committed, repaired, reverted, or escalated?"
`
}

function buildRepairPrompt({ task, pack, finalStatus, finalReason, diffSummary, validationSummary, anyFailed, repoMismatch, packCfg }) {
  if (repoMismatch && repoMismatch.status === 'STOP_REPO_MISMATCH') {
    return `# Workbench v${WORKBENCH_VERSION} — Repair Prompt

## Status
MANUAL_REVIEW_REQUIRED — REPO_MISMATCH

## Reason
${repoMismatch.reason}

## Action
Do not edit this repo for this task. Re-route the task to the correct repository.

## Forbidden
- do not commit
- do not push
- do not merge
- do not edit any file in this repo for this task
`
  }
  const failedScripts = validationSummary.filter((v) => v.status === 'FAILED')
  const allowed = (packCfg && packCfg.allowedPaths) || []
  const forbidden = (packCfg && packCfg.forbiddenPaths) || []

  if (!anyFailed && finalStatus === 'PROVEN') {
    return `# Workbench v${WORKBENCH_VERSION} — Repair Prompt

## Status
NO_REPAIR_NEEDED

## Reason
finalStatus is PROVEN; validation passed cleanly.

## Forbidden
- do not commit
- do not push
- do not merge
(without explicit user authorization)
`
  }
  if (!anyFailed && diffSummary.changedFiles.length === 0) {
    return `# Workbench v${WORKBENCH_VERSION} — Repair Prompt

## Status
MANUAL_REVIEW_REQUIRED

## Reason
finalStatus=${finalStatus} / finalReason=${finalReason}. Working tree is clean and no validation failed in this run; the failure is from a backlog of static-analysis findings, not a repairable diff.

## Forbidden
- do not commit
- do not push
- do not merge
`
  }
  const smallest = (() => {
    if (failedScripts.length > 0) return `npm run ${failedScripts[0].name} failed (exit ${failedScripts[0].code}). See validation.txt.`
    if (finalReason === 'EVAL_FAILED') return 'One or more evals reported FAILED. See eval-results.json for which eval and reason.'
    if (finalReason === 'TRUTH_VIOLATION') return 'Forbidden success language detected in claude-prompt or final-report.'
    if (finalReason === 'FORBIDDEN_PATH_TOUCHED') return `Forbidden path(s) modified: ${diffSummary.forbiddenFiles.join(', ') || '(see regression-check.json)'}.`
    if (finalReason === 'ANNOTATION_SELF_TEST_FAILED') return 'Workbench annotation parser self-test failed; fix scripts/ai-workbench.js.'
    if (finalReason === 'V0_4_SELF_TEST_FAILED') return 'Workbench v0.4 self-test failed; fix scripts/ai-workbench.js.'
    return `finalReason=${finalReason}.`
  })()
  const likelyCause = (() => {
    if (failedScripts.length > 0) return `npm run ${failedScripts[0].name} returned exit ${failedScripts[0].code}; the most recent product change likely broke compilation, tests, or build.`
    if (finalReason === 'EVAL_FAILED') return 'A mapped eval test reported FAILED, or the static-analysis evals integration-dead-code / real-call-site-validation flagged unused exports.'
    if (finalReason === 'TRUTH_VIOLATION') return 'Forbidden success language ("fixed", "working", "resolved", etc.) appeared in claude-prompt.md or final-report.md without PROVEN/HIGH evidence.'
    if (finalReason === 'FORBIDDEN_PATH_TOUCHED') return 'A forbidden path (out-of-pack screen, .env*, package.json, memory/*, etc.) was modified.'
    if (finalReason === 'ANNOTATION_SELF_TEST_FAILED') return 'The @workbench-keep annotation parser self-test fixtures failed.'
    if (finalReason === 'V0_4_SELF_TEST_FAILED') return 'One of the v0.4 review/repair-loop self-test fixtures failed.'
    if (finalReason === 'SAFETY_VIOLATION') return 'A safety constraint requested by the task (e.g. do-not-commit) was contradicted by an action claim in the final report.'
    if (finalReason === 'STOP_REPO_MISMATCH') return 'Task references unrelated project markers; current repo is not the right target.'
    return `finalReason=${finalReason}; cause not auto-classified.`
  })()
  return `# Workbench v${WORKBENCH_VERSION} — Repair Prompt

## Smallest failing issue
${smallest}

## Likely cause
${likelyCause}

## Allowed files
${allowed.length === 0 ? '(unrestricted within scripts/ai-workbench.js)' : allowed.map((p) => '- ' + p).join('\n')}

## Forbidden files
${forbidden.length === 0 ? '(none beyond pack defaults)' : forbidden.map((p) => '- ' + p).join('\n')}

## Validation commands
- npm run typecheck
- npm test
- npm run build

## Expected result
- exit 0 for typecheck, test, and build
- npm test: all suites pass
- npm run build: PWA bundle produced; do NOT commit memory/* regenerated by prebuild

## Forbidden
- do not commit
- do not push
- do not merge
(without explicit user authorization)
`
}

function runV04SelfTest({ projectRoot }) {
  const checks = []
  const expect = (label, ok) => { checks.push({ label, ok }); return ok }

  // Test 1: next-action JSON shape on a synthetic clean tree.
  const cleanDiff = { changedFiles: [], productFiles: [], workbenchFiles: [], generatedFiles: [], forbiddenFiles: [], packageFiles: [], envFiles: [], docsFiles: [], testFiles: [], summaryByPath: [], addedFiles: [], deletedFiles: [], modifiedFiles: [], gitStatusShort: '' }
  const naClean = buildNextAction({ task: 'noop', finalStatus: 'NOT_PROVEN', finalReason: 'NO_CORE_PROOF', diffSummary: cleanDiff, repoMismatch: { status: 'OK' }, evalCounts: { total: 0, proven: 0, notProven: 0, manualReview: 0, failed: 0 }, anyFailed: false })
  const requiredNAFields = ['recommendedAction', 'confidence', 'reason', 'allowedGitActions', 'forbiddenGitActions', 'filesToAdd', 'commitMessage', 'requiresHumanApproval', 'blockers', 'copyPasteReduction']
  expect('next-action has required fields', requiredNAFields.every((k) => Object.prototype.hasOwnProperty.call(naClean, k)))
  expect('next-action clean-tree is NO_ACTION', naClean.recommendedAction === 'NO_ACTION')

  // Test 2: decision-required JSON shape on a synthetic dead-symbol set.
  const drFixture = buildDecisionRequired({
    staticAnalysis: { symbols: [
      { name: 'generateScreen', classification: 'NOT_PROVEN_NO_USAGE', definingFile: 'src/services/stitch.ts', line: 42 },
      { name: 'editScreen', classification: 'NOT_PROVEN_NO_USAGE', definingFile: 'src/services/stitch.ts', line: 52 },
      { name: 'stitchAvailable', classification: 'NOT_PROVEN_NO_USAGE', definingFile: 'src/services/stitch.ts', line: 61 },
      { name: 'soundVoiceStart', classification: 'NOT_PROVEN_NO_USAGE', definingFile: 'src/services/sounds.ts', line: 113 },
      { name: 'streamSpeakVoiceMode', classification: 'NOT_PROVEN_NO_USAGE', definingFile: 'src/services/voice.ts', line: 656 },
    ] },
    repoMismatch: { status: 'OK' },
  })
  const requiredDRDecisionFields = ['id', 'type', 'status', 'summary', 'options', 'recommendation', 'risk', 'owner', 'reviewAfter', 'blocksAutoApproval']
  expect('decision-required has decisions array', Array.isArray(drFixture.decisions))
  expect('decision-required first decision has required fields', drFixture.decisions.length > 0 && requiredDRDecisionFields.every((k) => Object.prototype.hasOwnProperty.call(drFixture.decisions[0], k)))
  expect('decision-required surfaces stitch module', drFixture.decisions.some((d) => d.id === 'stitch-module'))
  expect('decision-required surfaces streamSpeakVoiceMode', drFixture.decisions.some((d) => d.id === 'streamSpeakVoiceMode'))

  // Test 3: diff-summary clean tree.
  const ds = buildDiffSummary({ regression: { parsed: [], buckets: {} }, gitStatusRaw: '' })
  expect('diff-summary clean changedFiles is empty', Array.isArray(ds.changedFiles) && ds.changedFiles.length === 0)

  // Test 4: repo-mismatch detects fake task in AbuBank repo.
  const fakeTask = 'Holistic transformation of src/zero2026/ZeroGameScreen.tsx via ActionDock and FactionRail.'
  const mmFake = detectRepoMismatch({ task: fakeTask, projectRoot })
  expect('repo-mismatch fake task is STOP_REPO_MISMATCH', mmFake.status === 'STOP_REPO_MISMATCH')
  expect('repo-mismatch fake task confidence HIGH', mmFake.confidence === 'HIGH')

  // Test 5: repo-mismatch returns OK on a normal AbuBank task.
  const normalTask = 'AbuCalendar voice flow improvement and AbuAI grounding tightening.'
  const mmOk = detectRepoMismatch({ task: normalTask, projectRoot })
  expect('repo-mismatch normal task is OK', mmOk.status === 'OK')

  // Test 6: review-prompt content includes required keywords.
  const reviewMd = buildReviewPrompt({
    task: 'demo', pack: 'abobank-ai', runDir: '/tmp/run', finalStatus: 'PROVEN', finalReason: 'CORE_PROOF_OBSERVED',
    diffSummary: cleanDiff, validationSummary: [{ name: 'test', status: 'OK', code: 0 }],
    evalCounts: { total: 0, proven: 0, notProven: 0, manualReview: 0, failed: 0 },
    staticAnalysis: { exportedSymbols: 0, counts: {} },
    regression: { status: 'PROVEN', issues: [], changed: 0 },
    safetyStatus: 'NOT_APPLICABLE', truthFlagged: [],
    repoMismatch: { status: 'OK' }, decisionRequired: { decisions: [] }, nextAction: naClean,
  })
  expect('review-prompt contains finalStatus', /finalStatus/.test(reviewMd))
  expect('review-prompt contains changed files', /Changed files/i.test(reviewMd))
  expect('review-prompt contains validation', /Validation/i.test(reviewMd))
  expect('review-prompt contains recommended reviewer decision', /Recommended reviewer decision/i.test(reviewMd))

  // Test 7: repair-prompt content includes required forbidden lines.
  const repairMd = buildRepairPrompt({
    task: 'demo', pack: 'abobank-ai', finalStatus: 'FAILED', finalReason: 'EVAL_FAILED',
    diffSummary: { ...cleanDiff, changedFiles: ['src/services/sounds.ts'], productFiles: ['src/services/sounds.ts'] },
    validationSummary: [{ name: 'test', status: 'OK', code: 0 }],
    anyFailed: false, repoMismatch: { status: 'OK' }, packCfg: { allowedPaths: ['src/services'], forbiddenPaths: [] },
  })
  expect('repair-prompt contains do not commit', /do not commit/i.test(repairMd))
  expect('repair-prompt contains do not push', /do not push/i.test(repairMd))
  expect('repair-prompt contains do not merge', /do not merge/i.test(repairMd))

  // Test 8: workbench-infra-only diff with green validation produces COMMIT_FEATURE_BRANCH.
  const wbInfraDiff = {
    changedFiles: ['scripts/ai-workbench.js'],
    productFiles: [],
    workbenchFiles: ['scripts/ai-workbench.js'],
    generatedFiles: [],
    forbiddenFiles: [],
    packageFiles: [],
    envFiles: [],
    docsFiles: [],
    testFiles: [],
    summaryByPath: [{ path: 'scripts/ai-workbench.js', code: ' M' }],
    addedFiles: [],
    deletedFiles: [],
    modifiedFiles: ['scripts/ai-workbench.js'],
    gitStatusShort: ' M scripts/ai-workbench.js\n',
  }
  const naInfra = buildNextAction({
    task: 'infra commit',
    finalStatus: 'FAILED',
    finalReason: 'EVAL_FAILED',
    diffSummary: wbInfraDiff,
    repoMismatch: { status: 'OK' },
    evalCounts: { total: 0, proven: 0, notProven: 0, manualReview: 0, failed: 0 },
    anyFailed: false,
    annotationSelfTest: { allPassed: true },
    v04SelfTest: { allPassed: true },
    branchName: 'claude/rewrite-hebrew-speech-qfnxi',
  })
  expect('workbench-infra-only diff recommends COMMIT_FEATURE_BRANCH', naInfra.recommendedAction === 'COMMIT_FEATURE_BRANCH')
  expect('workbench-infra-only filesToAdd contains scripts/ai-workbench.js', naInfra.filesToAdd.includes('scripts/ai-workbench.js'))
  expect('workbench-infra-only allowedGitActions includes feature-branch push', naInfra.allowedGitActions.some((s) => /git push origin claude\/rewrite-hebrew-speech-qfnxi/.test(s)))

  // Test 9: forbiddenGitActions never permit push to main, merge, .ai-runs, memory.
  const allForbidden = naInfra.forbiddenGitActions.join(' | ')
  expect('forbiddenGitActions blocks push to main', /git push origin main/.test(allForbidden))
  expect('forbiddenGitActions blocks merge', /git merge/.test(allForbidden))
  expect('forbiddenGitActions blocks adding .ai-runs', /\.ai-runs/.test(allForbidden))
  expect('forbiddenGitActions blocks adding memory', /memory/.test(allForbidden))

  // Test 10: review-prompt and next-action use the same finalStatus/finalReason as the fixture.
  const fixtureStatus = 'FAILED'
  const fixtureReason = 'EVAL_FAILED'
  const naSync = buildNextAction({
    task: 'sync', finalStatus: fixtureStatus, finalReason: fixtureReason,
    diffSummary: cleanDiff, repoMismatch: { status: 'OK' },
    evalCounts: { total: 0, proven: 0, notProven: 0, manualReview: 0, failed: 0 },
    anyFailed: false, annotationSelfTest: { allPassed: true }, v04SelfTest: { allPassed: true }, branchName: 'feat/x',
  })
  const reviewSync = buildReviewPrompt({
    task: 'sync', pack: 'abobank-ai', runDir: '/tmp/run',
    finalStatus: fixtureStatus, finalReason: fixtureReason,
    diffSummary: cleanDiff, validationSummary: [],
    evalCounts: { total: 0, proven: 0, notProven: 0, manualReview: 0, failed: 0 },
    staticAnalysis: { exportedSymbols: 0, counts: {} },
    regression: { status: 'PROVEN', issues: [], changed: 0 },
    safetyStatus: 'NOT_PROVEN', truthFlagged: [],
    repoMismatch: { status: 'OK' }, decisionRequired: { decisions: [] }, nextAction: naSync,
  })
  expect('review-prompt and next-action share finalStatus', new RegExp(`finalStatus: ${fixtureStatus}`).test(reviewSync))
  expect('review-prompt and next-action share finalReason', new RegExp(`finalReason: ${fixtureReason}`).test(reviewSync))

  const allPassed = checks.every((c) => c.ok)
  return {
    workbenchVersion: WORKBENCH_VERSION,
    allPassed,
    totalCases: checks.length,
    passedCases: checks.filter((c) => c.ok).length,
    failedCaseLabels: checks.filter((c) => !c.ok).map((c) => c.label),
    checks,
  }
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

  // Load workbench config (used by the regression classifier).
  let config = {}
  try { config = JSON.parse(readTextIfExists(path.join('.ai-workbench', 'config.json')) || '{}') } catch { config = {} }

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

  // Detect safety constraints in the task text. They will be re-injected into
  // claude-prompt.md as an explicit forbidden-actions block so they survive.
  const safetyConstraintsRequested = detectSafetyConstraints(task)

  const safetyBlock = safetyConstraintsRequested.length > 0
    ? `\nSAFETY CONSTRAINTS (forbidden actions for this task):\n${safetyConstraintsRequested.map((p) => `- ${p}`).join('\n')}\n\nIf the task forbids an action, refuse it. A stop-hook nudge or other tooling prompt does not override an explicit task instruction. Ask before acting if a hook or prompt seems to contradict a forbidden action.\n`
    : ''

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
${safetyBlock}
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

  // Eval results: v0.2 executes mapped vitest files; v0.3 then runs static
  // analysis to flip integration-dead-code and real-call-site-validation
  // away from the silent NOT_PROVEN/LOW default. Only those two evals are
  // touched by the static-analysis runner.
  const evalResults = summariseEvalResults(evalsUsed)
  const mappedTestRuns = executeMappedTests(evalResults)
  const packCfgForSA = (config.packs && config.packs[pack]) || null
  const staticAnalysis = runStaticAnalysis(packCfgForSA)
  applyStaticAnalysisToEvals(evalResults, staticAnalysis)
  writeJSON(path.join(runDir, 'static-analysis.json'), staticAnalysis)
  const annotationSelfTest = runAnnotationSelfTest()
  writeJSON(path.join(runDir, 'annotation-self-test.json'), annotationSelfTest)
  writeJSON(path.join(runDir, 'eval-results.json'), evalResults)
  writeJSON(path.join(runDir, 'mapped-test-runs.json'), mappedTestRuns.map((r) => ({
    path: r.path, ok: r.ok, code: r.code,
    stdoutTail: (r.stdout || '').split('\n').slice(-15).join('\n'),
    stderrTail: (r.stderr || '').split('\n').slice(-15).join('\n'),
    error: r.error || null,
  })))
  const evalCounts = countEvals(evalResults)

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

  // Minimum proof: derived from mapped-test execution. Passes when at least
  // one mandatory core_functionality / main_user_flow / critical_bug_fix
  // eval is now PROVEN with HIGH confidence.
  const minimumProof = computeMinimumProof(evalResults)

  // Regression check — minimal git-aware classifier of working-tree changes.
  let regression
  const gs = gitStatusShort()
  if (!gs.ok) {
    regression = {
      status: 'NOT_PROVEN',
      confidence: 'LOW',
      reason: 'git status failed; regression evidence not gathered.',
      gitStderr: gs.stderr,
    }
  } else {
    const changed = parseGitStatus(gs.stdout)
    const packCfg = (config.packs && config.packs[pack]) || null
    const buckets = {
      allowedPaths: [],
      forbiddenPaths: [],
      forbiddenSecrets: [],
      unrelatedPaths: [],
      generatedFiles: [],
      packageFiles: [],
      workbenchInfra: [],
    }
    for (const f of changed) {
      const c = classifyChangedFile(f.path, packCfg)
      buckets[c.bucket].push(f.path)
    }
    const issues = []
    let status = 'PROVEN'
    let confidence = 'MEDIUM'
    if (buckets.forbiddenPaths.length > 0 || buckets.forbiddenSecrets.length > 0) {
      status = 'FAILED'
      confidence = 'HIGH'
      issues.push('FORBIDDEN_PATH_TOUCHED')
    } else if (buckets.packageFiles.length > 0) {
      status = 'MANUAL_REVIEW'
      confidence = 'HIGH'
      issues.push('HUMAN_APPROVAL_REQUIRED')
    } else if (buckets.unrelatedPaths.length > 0) {
      status = 'MANUAL_REVIEW'
      confidence = 'MEDIUM'
      issues.push('RISK_UNRELATED_CHANGE')
    } else if (changed.length === 0) {
      status = 'PROVEN'
      confidence = 'HIGH'
    }
    regression = {
      status,
      confidence,
      issues,
      changed: changed.length,
      buckets,
      parsed: changed,
      gitStatusRaw: gs.stdout,
      note: 'v0.2 minimal git-aware regression classifier. No diff content analysis.',
    }
  }
  // The on-disk regression-check.json keeps the v0.2 shape (no parsed/raw
  // fields) for backwards compatibility with prior runs.
  const { parsed: _regParsed, gitStatusRaw: _regGitRaw, ...regressionForDisk } = regression
  writeJSON(path.join(runDir, 'regression-check.json'), regressionForDisk)

  // Drift — honest: no baseline implementation yet, so we explicitly say
  // drift was NOT checked rather than implying a check ran and produced
  // NOT_PROVEN.
  writeJSON(path.join(runDir, 'drift-check.json'), {
    status: 'NOT_PROVEN',
    confidence: 'LOW',
    reason: 'UNKNOWN_BASELINE',
    checked: false,
    note: 'Drift was NOT checked. v0.2 has no recorded baseline to compare against.',
  })

  writeJSON(path.join(runDir, 'source-conflicts.json'), {
    status: 'NOT_PROVEN',
    confidence: 'LOW',
    conflicts: [],
    note: 'Evidence-tagged context loaded; deterministic conflict resolution not implemented in v0.2.',
  })

  // Pre-final safety check: confirm the constraints from the task were
  // preserved in claude-prompt.md. Post-final scan (after the report is
  // written) looks for action claims that contradict those constraints.
  const promptText = readTextIfExists(claudePromptPath)
  const safetyConstraintsInPrompt = detectSafetyConstraints(promptText)
  const constraintsPreservedInPrompt = safetyConstraintsRequested.every(
    (p) => promptText.toLowerCase().includes(p),
  )
  const preFinalSafetyViolations = scanSafetyViolationsInResultSections(claudePromptPath)

  // v0.4 — repo-mismatch guard, self-test, review/repair/next-action/diff/decision artifacts.
  const repoMismatch = detectRepoMismatch({ task, projectRoot: process.cwd() })
  writeJSON(path.join(runDir, 'repo-mismatch.json'), repoMismatch)
  const v04SelfTest = runV04SelfTest({ projectRoot: process.cwd() })
  writeJSON(path.join(runDir, 'v04-self-test.json'), v04SelfTest)
  const diffSummary = buildDiffSummary({ regression, gitStatusRaw: regression.gitStatusRaw })
  writeJSON(path.join(runDir, 'diff-summary.json'), diffSummary)
  const decisionRequired = buildDecisionRequired({ staticAnalysis, repoMismatch })
  writeJSON(path.join(runDir, 'decision-required.json'), decisionRequired)

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
      proven: evalCounts.proven,
      notProven: evalCounts.notProven,
      manualReview: evalCounts.manualReview,
      failed: evalCounts.failed,
    },
    mappedTestSummary: {
      uniqueMappedTestsRun: mappedTestRuns.length,
      passed: mappedTestRuns.filter((r) => r.ok).length,
      failedOrMissing: mappedTestRuns.filter((r) => !r.ok).length,
      reasons: mappedTestRuns.map((r) => ({
        path: r.path, ok: r.ok, exitCode: r.code, reason: r.reason, evalIds: r.evalIds,
      })),
    },
    minimumProof,
    truthViolationPreFinal: {
      status: truthFlagged.length > 0 ? 'FAILED' : 'NOT_PROVEN',
      confidence: truthFlagged.length > 0 ? 'HIGH' : 'LOW',
      reason: truthFlagged.length > 0 ? 'TRUTH_VIOLATION' : 'No forbidden success language detected pre-final-report.',
      matchCount: truthFlagged.length,
    },
    safetyPreFinal: {
      requested: safetyConstraintsRequested,
      preservedInPrompt: constraintsPreservedInPrompt,
      violationMatchCount: preFinalSafetyViolations.length,
    },
    regression: {
      status: regression.status,
      issues: regression.issues || [],
    },
    annotationSelfTest: {
      allPassed: annotationSelfTest.allPassed,
      totalCases: annotationSelfTest.totalCases,
      passedCases: annotationSelfTest.passedCases,
      failedCaseIds: annotationSelfTest.results.filter((r) => !r.passed).map((r) => r.id),
      confidence: 'HIGH',
      failureReason: annotationSelfTest.allPassed ? null : 'ANNOTATION_SELF_TEST_FAILED',
    },
    v04SelfTest: {
      allPassed: v04SelfTest.allPassed,
      totalCases: v04SelfTest.totalCases,
      passedCases: v04SelfTest.passedCases,
      failedCaseLabels: v04SelfTest.failedCaseLabels,
      confidence: 'HIGH',
      failureReason: v04SelfTest.allPassed ? null : 'V0_4_SELF_TEST_FAILED',
    },
    repoMismatch: {
      status: repoMismatch.status,
      confidence: repoMismatch.confidence,
      reason: repoMismatch.reason,
      matchedMarkers: repoMismatch.matchedMarkers,
      missingPathMentions: repoMismatch.missingPathMentions,
    },
    autoApproval: false,
    finalStatus: repoMismatch.status === 'STOP_REPO_MISMATCH'
      ? 'FAILED'
      : !v04SelfTest.allPassed
      ? 'FAILED'
      : !annotationSelfTest.allPassed
      ? 'FAILED'
      : anyFailed
      ? 'FAILED'
      : truthFlagged.length > 0
      ? 'FAILED'
      : regression.status === 'FAILED'
      ? 'FAILED'
      : evalCounts.failed > 0
      ? 'FAILED'
      : minimumProof.status === 'PROVEN'
      ? 'PROVEN'
      : 'NOT_PROVEN',
    finalReason: repoMismatch.status === 'STOP_REPO_MISMATCH'
      ? 'STOP_REPO_MISMATCH'
      : !v04SelfTest.allPassed
      ? 'V0_4_SELF_TEST_FAILED'
      : !annotationSelfTest.allPassed
      ? 'ANNOTATION_SELF_TEST_FAILED'
      : anyFailed
      ? 'VALIDATION_FAILED'
      : truthFlagged.length > 0
      ? 'TRUTH_VIOLATION'
      : regression.status === 'FAILED'
      ? 'FORBIDDEN_PATH_TOUCHED'
      : evalCounts.failed > 0
      ? 'EVAL_FAILED'
      : minimumProof.status === 'PROVEN'
      ? 'CORE_PROOF_OBSERVED'
      : 'NO_CORE_PROOF',
    finalConfidence: (repoMismatch.status === 'STOP_REPO_MISMATCH' || !v04SelfTest.allPassed || !annotationSelfTest.allPassed) ? 'HIGH' : null,
    note: 'v0.2 runs validation, the forbidden-language scan, the git-aware regression classifier, the safety-constraint scan, and now executes mapped vitest files for each eval. Evals whose mapped file passed are PROVEN/HIGH; failed mapped files are FAILED/HIGH; evals without mappedTest stay NOT_PROVEN/LOW.',
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

  function buildFinalReport(args) {
    const safetyLine = (() => {
      if (safetyConstraintsRequested.length === 0) return '- requested constraints: (none)\n- safety scan not applicable'
      const lines = [
        `- requested constraints: ${safetyConstraintsRequested.join(', ')}`,
        `- preserved in claude-prompt.md: ${args.preservedInPrompt ? 'YES' : 'NO'}`,
        `- preserved in final-report.md: ${args.preservedInFinalReport === undefined ? 'pending post-final scan' : (args.preservedInFinalReport ? 'YES' : 'NO')}`,
        `- safety status: ${args.safetyStatus}`,
        `- safety reason: ${args.safetyReason}`,
        `- safety confidence: ${args.safetyConfidence}`,
        `- human review required: ${args.humanReviewRequired ? 'YES' : 'no'}`,
      ]
      return lines.join('\n')
    })()
    const readyForClaudeLine = args.readyForClaude
      ? 'YES — validation passed at the infra level and no safety violation was detected. Pasting claude-prompt.md is acceptable. This is not approval of any product change.'
      : 'NO — a blocker was detected (validation failure, truth violation, safety violation, or forbidden-path change).'
    return `# AI Workbench v${WORKBENCH_VERSION} Run Report

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
- PROVEN: ${evalCounts.proven}
- NOT_PROVEN: ${evalCounts.notProven}
- MANUAL_REVIEW: ${evalCounts.manualReview}
- FAILED: ${evalCounts.failed}
v0.2 executes mapped vitest files. Evals with a passing mappedTest are PROVEN/HIGH; failed mappedTest → FAILED/HIGH; no mappedTest → NOT_PROVEN/LOW.
Mapped test runs recorded in mapped-test-runs.json.

## 5. Evidence status
- finalStatus: ${args.overallStatus}
- finalReason: ${args.overallReason}
- autoApproval: false

## 6. Truth violation status
- ${args.truthStatus} (matches: ${args.truthMatchCount})

## 7. Regression status
- ${regression.status}${regression.issues && regression.issues.length ? ' — ' + regression.issues.join(', ') : ''}
- changed files: ${regression.changed ?? 'n/a'}
- buckets: allowed=${(regression.buckets?.allowedPaths?.length) ?? 0}, forbidden=${(regression.buckets?.forbiddenPaths?.length) ?? 0}, secrets=${(regression.buckets?.forbiddenSecrets?.length) ?? 0}, unrelated=${(regression.buckets?.unrelatedPaths?.length) ?? 0}, generated=${(regression.buckets?.generatedFiles?.length) ?? 0}, package=${(regression.buckets?.packageFiles?.length) ?? 0}, workbench-infra=${(regression.buckets?.workbenchInfra?.length) ?? 0}

## 8. Drift status
- NOT_PROVEN — UNKNOWN_BASELINE. Drift was NOT checked. v0.2 has no recorded baseline to compare against.

## 9. Source conflict status
- NOT_PROVEN — context evidence-tagged but deterministic conflict resolution not implemented in v0.2.

## 10. Safety status
${safetyLine}

## 11. Minimum proof status
- ${minimumProof.status} — ${minimumProof.reason}

## 11b. Annotation self-test status
- ${annotationSelfTest.allPassed ? 'PASSED' : 'FAILED — ANNOTATION_SELF_TEST_FAILED (HIGH confidence)'} (${annotationSelfTest.passedCases}/${annotationSelfTest.totalCases} cases)${annotationSelfTest.allPassed ? '' : `\n- failing cases: ${annotationSelfTest.results.filter((r) => !r.passed).map((r) => r.id).join(', ')}\n- annotation parser self-test gates the run; finalStatus is FAILED until parser fixtures pass.`}
- artifact: ${path.join(runDir, 'annotation-self-test.json')}

## 11c. v0.4 self-test status
- ${v04SelfTest.allPassed ? 'PASSED' : 'FAILED — V0_4_SELF_TEST_FAILED (HIGH confidence)'} (${v04SelfTest.passedCases}/${v04SelfTest.totalCases} cases)${v04SelfTest.allPassed ? '' : `\n- failing cases: ${v04SelfTest.failedCaseLabels.join(', ')}\n- v0.4 review/repair/next-action self-test gates the run; finalStatus is FAILED until fixtures pass.`}
- artifact: ${path.join(runDir, 'v04-self-test.json')}

## 11d. Repo-mismatch guard
- status: ${repoMismatch.status}
- confidence: ${repoMismatch.confidence}
- reason: ${repoMismatch.reason}${repoMismatch.matchedMarkers && repoMismatch.matchedMarkers.length ? `\n- matched markers: ${repoMismatch.matchedMarkers.join(', ')}` : ''}${repoMismatch.missingPathMentions && repoMismatch.missingPathMentions.length ? `\n- missing path mentions: ${repoMismatch.missingPathMentions.slice(0, 5).join(', ')}` : ''}

## 11e. v0.4 artifacts
- review-prompt.md: ${path.join(runDir, 'review-prompt.md')}
- repair-prompt.md: ${path.join(runDir, 'repair-prompt.md')}
- next-action.json: ${path.join(runDir, 'next-action.json')} (recommendedAction: ${args.nextActionRecommendation || 'pending post-final scan'})
- decision-required.json: ${path.join(runDir, 'decision-required.json')} (${decisionRequired.decisions.length} open)
- diff-summary.json: ${path.join(runDir, 'diff-summary.json')} (${diffSummary.changedFiles.length} changed)
- repo-mismatch.json: ${path.join(runDir, 'repo-mismatch.json')}

## 12. Ready for Claude Code execution
${readyForClaudeLine}

## 13. Ready for auto-approval
NO — NOT READY FOR AUTO-APPROVAL.

## 14. Next step
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
- safety-check.json      → ${path.join(runDir, 'safety-check.json')}
`
  }

  // First pass: write a placeholder report that reflects pre-final scan
  // results so the truth + safety scanners have a real file to scan.
  fs.writeFileSync(finalReportPath, buildFinalReport({
    overallStatus,
    overallReason,
    truthStatus: evidence.truthViolationPreFinal.status,
    truthMatchCount: evidence.truthViolationPreFinal.matchCount,
    preservedInPrompt: constraintsPreservedInPrompt,
    preservedInFinalReport: undefined,
    safetyStatus: safetyConstraintsRequested.length === 0 ? 'NOT_PROVEN' : 'PENDING_POST_SCAN',
    safetyReason: safetyConstraintsRequested.length === 0 ? 'No safety constraints requested by the task.' : 'pending post-final scan',
    safetyConfidence: 'LOW',
    humanReviewRequired: false,
    readyForClaude,
  }))

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

  // Post-final safety scan: look for action-claim phrases in result/status
  // sections of the final report when the task asked us not to take them.
  const postFinalSafetyViolations = scanSafetyViolationsInResultSections(finalReportPath)
  const finalReportText = readTextIfExists(finalReportPath)
  const constraintsPreservedInFinalReport = safetyConstraintsRequested.every(
    (p) => finalReportText.toLowerCase().includes(p),
  )
  let safetyStatus = 'NOT_PROVEN'
  let safetyReason = 'No safety constraints requested by the task.'
  let safetyConfidence = 'LOW'
  if (safetyConstraintsRequested.length > 0) {
    if (postFinalSafetyViolations.length > 0 || preFinalSafetyViolations.length > 0) {
      safetyStatus = 'FAILED'
      safetyReason = 'SAFETY_VIOLATION_DETECTED'
      safetyConfidence = 'HIGH'
    } else if (!constraintsPreservedInPrompt) {
      safetyStatus = 'FAILED'
      safetyReason = 'SAFETY_CONSTRAINT_MISSING'
      safetyConfidence = 'HIGH'
    } else {
      safetyStatus = 'PROVEN'
      safetyReason = 'SAFETY_CONSTRAINT_PRESERVED'
      safetyConfidence = 'MEDIUM'
    }
  }
  const safetyCheck = {
    workbenchVersion: WORKBENCH_VERSION,
    forbiddenGitActionsRequested: safetyConstraintsRequested,
    preservedInPrompt: constraintsPreservedInPrompt,
    preservedInFinalReport: constraintsPreservedInFinalReport,
    preFinalSafetyViolationMatches: preFinalSafetyViolations,
    postFinalSafetyViolationMatches: postFinalSafetyViolations,
    status: safetyStatus,
    reason: safetyReason,
    confidence: safetyConfidence,
    humanReviewRequired: safetyStatus === 'FAILED',
  }
  writeJSON(path.join(runDir, 'safety-check.json'), safetyCheck)

  // If a post-scan check (truth or safety) flipped the verdict, surface it.
  let updatedFinalStatus = evidence.finalStatus
  let updatedFinalReason = evidence.finalReason
  if (safetyStatus === 'FAILED') {
    updatedFinalStatus = 'FAILED'
    updatedFinalReason = 'SAFETY_VIOLATION'
  } else if (truthViolation.status === 'FAILED') {
    updatedFinalStatus = 'FAILED'
    updatedFinalReason = 'TRUTH_VIOLATION'
  }
  if (updatedFinalStatus !== evidence.finalStatus || updatedFinalReason !== evidence.finalReason) {
    writeJSON(path.join(runDir, 'evidence-check.json'), {
      ...evidence,
      finalStatus: updatedFinalStatus,
      finalReason: updatedFinalReason,
      truthViolationPostFinal: {
        status: truthViolation.status,
        confidence: truthViolation.confidence,
        matchCount: truthViolation.matchCount,
      },
      safetyPostFinal: {
        status: safetyStatus,
        confidence: safetyConfidence,
        reason: safetyReason,
        violationMatchCount: postFinalSafetyViolations.length,
      },
    })
  }

  // v0.4 — compute and write review/repair/next-action AFTER all post-final
  // scans so they use the same canonical finalStatus/finalReason as
  // evidence-check.json.
  const canonicalFinalStatus = updatedFinalStatus
  const canonicalFinalReason = updatedFinalReason
  const packCfgForV04 = (config.packs && config.packs[pack]) || null
  let branchName = null
  try {
    const br = spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' })
    if (br.status === 0) branchName = (br.stdout || '').trim() || null
  } catch { branchName = null }
  const nextAction = buildNextAction({
    task,
    finalStatus: canonicalFinalStatus,
    finalReason: canonicalFinalReason,
    diffSummary,
    repoMismatch,
    evalCounts,
    anyFailed,
    annotationSelfTest,
    v04SelfTest,
    branchName,
  })
  writeJSON(path.join(runDir, 'next-action.json'), nextAction)
  const reviewPromptText = buildReviewPrompt({
    task, pack, runDir,
    finalStatus: canonicalFinalStatus,
    finalReason: canonicalFinalReason,
    diffSummary, validationSummary, evalCounts,
    staticAnalysis, regression,
    safetyStatus,
    truthFlagged,
    repoMismatch, decisionRequired, nextAction,
  })
  fs.writeFileSync(path.join(runDir, 'review-prompt.md'), reviewPromptText)
  const repairPromptText = buildRepairPrompt({
    task, pack,
    finalStatus: canonicalFinalStatus,
    finalReason: canonicalFinalReason,
    diffSummary, validationSummary, anyFailed, repoMismatch, packCfg: packCfgForV04,
  })
  fs.writeFileSync(path.join(runDir, 'repair-prompt.md'), repairPromptText)

  // Second pass: rewrite final-report.md so it reflects the post-scan
  // verdict (safety status, truth status, ready-for-Claude). The truth
  // scanner is re-run on the rewritten report so its match list stays
  // accurate.
  const finalReadyForClaude = !anyFailed
    && updatedFinalStatus !== 'FAILED'
    && safetyStatus !== 'FAILED'
    && truthViolation.status !== 'FAILED'
    && regression.status !== 'FAILED'
  fs.writeFileSync(finalReportPath, buildFinalReport({
    overallStatus: updatedFinalStatus,
    overallReason: updatedFinalReason,
    truthStatus: truthViolation.status,
    truthMatchCount: truthViolation.matchCount,
    preservedInPrompt: constraintsPreservedInPrompt,
    preservedInFinalReport: constraintsPreservedInFinalReport,
    safetyStatus,
    safetyReason,
    safetyConfidence,
    humanReviewRequired: safetyStatus === 'FAILED',
    readyForClaude: finalReadyForClaude,
    nextActionRecommendation: nextAction.recommendedAction,
  }))

  // Re-scan the rewritten final report so truth-violations.json is exact.
  const truthScanFinal = scanAllForbidden([claudePromptPath, finalReportPath])
  const truthFlaggedFinal = truthScanFinal.flatMap((f) => f.matches)
  if (truthFlaggedFinal.length !== truthViolation.matchCount) {
    writeJSON(path.join(runDir, 'truth-violations.json'), {
      ...truthViolation,
      matchCount: truthFlaggedFinal.length,
      status: truthFlaggedFinal.length > 0 ? 'FAILED' : 'NOT_PROVEN',
      confidence: truthFlaggedFinal.length > 0 ? 'HIGH' : 'LOW',
      reason: truthFlaggedFinal.length > 0 ? 'TRUTH_VIOLATION' : 'No forbidden success language detected outside policy sections.',
      matches: truthFlaggedFinal,
    })
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
