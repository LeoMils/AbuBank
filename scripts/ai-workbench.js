import fs from 'fs'
import path from 'path'

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

  const contextFiles = readDirFiles(contextDir, '.md')
  const evalFiles = readDirFiles(evalsDir, '.json')

  fs.writeFileSync(path.join(runDir, 'task.txt'), task)

  const contextUsed = contextFiles.map((file) => `# ${file.name}\n\n${file.content}`).join('\n\n---\n\n')
  fs.writeFileSync(path.join(runDir, 'context-used.md'), contextUsed)

  const evalsUsed = evalFiles.map((file) => {
    let parsed = null
    try { parsed = JSON.parse(file.content) } catch { parsed = { parseError: true, raw: file.content } }
    return { name: file.name, path: file.path, content: parsed }
  })
  fs.writeFileSync(path.join(runDir, 'evals-used.json'), JSON.stringify(evalsUsed, null, 2))

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
  fs.writeFileSync(path.join(runDir, 'claude-prompt.md'), claudePrompt)

  const evalResults = evalsUsed.map((item) => ({
    eval: item.name,
    status: 'NOT_PROVEN',
    confidence: 'LOW',
    reason: 'Workbench v0.1 minimal runner does not execute app-level evals yet.',
  }))
  fs.writeFileSync(path.join(runDir, 'eval-results.json'), JSON.stringify(evalResults, null, 2))

  const evidence = {
    status: 'FAILED',
    reason: 'NO_CORE_PROOF',
    confidence: 'LOW',
    note: 'Minimal v0.1 generated prompt/context/evals only. It does not prove product behavior.',
    validation: 'NOT_RUN_IN_MINIMAL_SCRIPT',
    autoApproval: false,
  }
  fs.writeFileSync(path.join(runDir, 'evidence-check.json'), JSON.stringify(evidence, null, 2))

  fs.writeFileSync(path.join(runDir, 'regression-check.json'), JSON.stringify({
    status: 'NOT_PROVEN',
    confidence: 'LOW',
    reason: 'No diff/regression check in minimal v0.1 script.',
  }, null, 2))

  fs.writeFileSync(path.join(runDir, 'drift-check.json'), JSON.stringify({
    status: 'NOT_PROVEN',
    confidence: 'LOW',
    reason: 'UNKNOWN_BASELINE',
  }, null, 2))

  fs.writeFileSync(path.join(runDir, 'truth-violations.json'), JSON.stringify({
    status: 'NOT_PROVEN',
    confidence: 'LOW',
    reason: 'No generated-result success claim checked beyond minimal artifacts.',
  }, null, 2))

  fs.writeFileSync(path.join(runDir, 'source-conflicts.json'), JSON.stringify({
    status: 'NOT_PROVEN',
    confidence: 'LOW',
    conflicts: [],
  }, null, 2))

  fs.writeFileSync(path.join(runDir, 'validation.txt'), 'NOT_RUN_IN_MINIMAL_SCRIPT\n')

  const finalReport = `# AI Workbench Minimal v0.1 Report

## Original task
${task}

## Selected pack
${pack}

## Status
FAILED — NO_CORE_PROOF

## Meaning
This minimal runner generated the Workbench artifacts but did not prove product behavior.

## Generated artifacts
- ${path.join(runDir, 'claude-prompt.md')}
- ${path.join(runDir, 'final-report.md')}
- ${path.join(runDir, 'evidence-check.json')}
- ${path.join(runDir, 'regression-check.json')}
- ${path.join(runDir, 'drift-check.json')}
- ${path.join(runDir, 'truth-violations.json')}
- ${path.join(runDir, 'source-conflicts.json')}

## Next step
Review claude-prompt.md before using it with Claude Code.
`
  fs.writeFileSync(path.join(runDir, 'final-report.md'), finalReport)

  console.log('WORKBENCH_MINIMAL_RUN_CREATED')
  console.log(`RUN_DIR=${runDir}`)
  console.log(`CLAUDE_PROMPT=${path.join(runDir, 'claude-prompt.md')}`)
  console.log(`FINAL_REPORT=${path.join(runDir, 'final-report.md')}`)
}

main()
