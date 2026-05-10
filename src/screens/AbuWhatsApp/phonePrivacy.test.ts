/*
 * Phone-number privacy scan.
 *
 * AbuBank is a public repo with a public Vercel preview. Real phone numbers
 * must never enter committed source/docs/tests/memory/knowledge. This test
 * walks the relevant directories and fails if it finds any committed string
 * that looks like an E.164 phone number, with a small allow-list for safe
 * placeholders and pinned synthetic test fixtures.
 *
 * The report deliberately reports only the file path and a redacted excerpt
 * (just the count of matching tokens) — never the matched digits — so a CI
 * failure log cannot itself leak a phone number.
 */

import fs from 'fs'
import path from 'path'
import { describe, it, expect } from 'vitest'

const PROJECT_ROOT = path.resolve(__dirname, '../../..')

// Directories scanned for committed phone-like strings.
const SCAN_DIRS = [
  'src',
  'docs',
  'memory',
  'knowledge',
  'public/family-contacts', // filenames only, never bytes
]

// Files / dir prefixes that are NEVER scanned for content, because they
// either contain binary or are not source-of-truth product files.
const SKIP_PATH_PREFIXES = [
  'node_modules/',
  'dist/',
  '.git/',
  '.vercel/',
  '.ai-runs/',
]

// File extensions whose content we scan. Anything else (images, fonts,
// binaries) is skipped.
const SCANNED_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx',
  '.md', '.mdx',
  '.json',
  '.yaml', '.yml',
  '.html', '.css',
])

// Pinned synthetic test fixtures. These are obvious all-same-digit and
// 1234567-suffix placeholder strings used only inside *.test.ts to exercise
// the E.164 validators / URL builders. They are NOT real phone numbers.
const PINNED_SYNTHETIC = new Set<string>([
  '+972501234567',
  '+972501111111',
  '+972502222222',
  // seededStorageRepro.test.ts uses three obvious +972500000001/2/3 stubs.
  '+972500000001',
  '+972500000002',
  '+972500000003',
])

/**
 * Returns true if the captured "+digits" looks like a real phone number that
 * should not be in source. False if it is clearly a placeholder (X-masked), a
 * pinned synthetic test fixture (with dashes/spaces collapsed), or too short
 * to be E.164.
 */
function isSuspiciousPhoneToken(token: string): boolean {
  // Normalize: drop dashes and spaces. "+972-50 123 4567" → "+972501234567".
  const normalized = token.replace(/[\s\-]/g, '')
  if (PINNED_SYNTHETIC.has(normalized)) return false
  const after = normalized.replace(/^\+/, '')
  // Placeholder masks (e.g. 972XXXXXXXXX) are safe.
  if (/X/i.test(after)) return false
  // Need at least 8 digits to qualify as a phone number (E.164 lower bound).
  const digits = after.replace(/[^0-9]/g, '')
  if (digits.length < 8) return false
  if (digits.length > 15) return false
  return true
}

function walk(dir: string, out: string[]): void {
  let entries: fs.Dirent[]
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) }
  catch { return }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    const rel = path.relative(PROJECT_ROOT, full).split(path.sep).join('/')
    if (SKIP_PATH_PREFIXES.some((p) => rel.startsWith(p))) continue
    if (entry.isDirectory()) { walk(full, out); continue }
    if (!entry.isFile()) continue
    const ext = path.extname(entry.name).toLowerCase()
    if (!SCANNED_EXTS.has(ext)) continue
    out.push(full)
  }
}

function collectFiles(): string[] {
  const out: string[] = []
  for (const d of SCAN_DIRS) {
    walk(path.join(PROJECT_ROOT, d), out)
  }
  return out
}

describe('phone-number privacy scan (committed sources, docs, memory, knowledge)', () => {
  const files = collectFiles()

  it('finds at least one file to scan (sanity)', () => {
    expect(files.length).toBeGreaterThan(50)
  })

  it('contains no real-looking phone tokens in committed files', () => {
    const offenders: { path: string; matchCount: number }[] = []
    // Match leading '+' that is IMMEDIATELY followed by a digit or X
    // placeholder (no whitespace gap — `Date.now() + 86400000` is arithmetic,
    // not a phone) and then 6-29 more phone-class chars (digits, X, dashes,
    // spaces).
    const TOKEN_RE = /\+[0-9Xx][0-9Xx\- ]{6,29}/g
    for (const file of files) {
      let raw: string
      try { raw = fs.readFileSync(file, 'utf8') }
      catch { continue }
      const tokens = raw.match(TOKEN_RE) ?? []
      let suspiciousCount = 0
      for (const tok of tokens) {
        // Trim trailing punctuation
        const cleaned = tok.replace(/[^\d+Xx]+$/, '')
        if (isSuspiciousPhoneToken(cleaned)) suspiciousCount++
      }
      if (suspiciousCount > 0) {
        const rel = path.relative(PROJECT_ROOT, file).split(path.sep).join('/')
        offenders.push({ path: rel, matchCount: suspiciousCount })
      }
    }
    // Report only paths and counts — never the matched digits.
    expect(offenders, `phone-like tokens found in committed files: ${JSON.stringify(offenders)}`)
      .toEqual([])
  })

  it('memory/* never contains the localStorage key, scaffold ids, or phone-like digits', () => {
    // Spot-check the regenerated memory files: they must not embed any
    // AbuWhatsApp private surface or phone-like value.
    const memoryFiles = [
      'memory/aliases_and_names.yaml',
      'memory/family_graph.yaml',
      'memory/martita_profile.yaml',
    ]
    for (const rel of memoryFiles) {
      const p = path.join(PROJECT_ROOT, rel)
      if (!fs.existsSync(p)) continue
      const raw = fs.readFileSync(p, 'utf8')
      expect(raw.includes('abubank.familyContacts.v1'), `${rel} leaks the localStorage key`).toBe(false)
      // No raw E.164: a leading + followed by 8+ digits with no X mask.
      const m = raw.match(/\+\d{8,15}/g)
      expect(m, `${rel} contains phone-like tokens`).toBeNull()
    }
  })

  it('.ai-runs/ directory is not staged into the bundle (untracked allowed)', () => {
    // .ai-runs is gitignored; the scan above already skips it. This test just
    // documents the rule and asserts the gitignore line is present.
    const gi = fs.readFileSync(path.join(PROJECT_ROOT, '.gitignore'), 'utf8')
    expect(gi.includes('.ai-runs/')).toBe(true)
  })

  it('.gitignore protects private/ and *.local.json', () => {
    const gi = fs.readFileSync(path.join(PROJECT_ROOT, '.gitignore'), 'utf8')
    expect(gi.includes('private/')).toBe(true)
    expect(gi.includes('*.local.json')).toBe(true)
  })

  it('the example import file contains only placeholder phones', () => {
    const examplePath = path.join(PROJECT_ROOT, 'docs/examples/abuwhatsapp-contacts.import.example.json')
    expect(fs.existsSync(examplePath)).toBe(true)
    const raw = fs.readFileSync(examplePath, 'utf8')
    // Every non-empty phoneE164 / whatsappE164 must be the X-mask placeholder.
    const phoneStrings: string[] = []
    const RE = /"(?:phoneE164|whatsappE164)"\s*:\s*"([^"]*)"/g
    let m: RegExpExecArray | null
    while ((m = RE.exec(raw)) !== null) {
      phoneStrings.push(m[1] ?? '')
    }
    for (const v of phoneStrings) {
      if (v === '') continue
      expect(/^\+\d*X+$/.test(v), `non-placeholder value in example file`).toBe(true)
    }
  })
})

describe('AbuWhatsApp scaffold guarantees (cross-checks)', () => {
  it('familyContacts.private.ts commits zero non-empty phoneE164 literals', () => {
    const src = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyContacts.private.ts'),
      'utf8',
    )
    // Every phoneE164 line must end with empty string.
    const phoneLines = src.match(/phoneE164:\s*'[^']*'/g) ?? []
    expect(phoneLines.length).toBeGreaterThan(0)
    for (const line of phoneLines) {
      expect(line, 'scaffold phoneE164 must be empty string').toMatch(/phoneE164:\s*''/)
    }
  })

  it('localStorage key is locked to abubank.familyContacts.v1', () => {
    const src = fs.readFileSync(
      path.join(PROJECT_ROOT, 'src/screens/AbuWhatsApp/familyContactsStorage.ts'),
      'utf8',
    )
    expect(src.includes("'abubank.familyContacts.v1'")).toBe(true)
  })

  it('docs/abuwhatsapp-data-model.md exists and references the storage key', () => {
    const p = path.join(PROJECT_ROOT, 'docs/abuwhatsapp-data-model.md')
    expect(fs.existsSync(p)).toBe(true)
    const raw = fs.readFileSync(p, 'utf8')
    expect(raw.includes('abubank.familyContacts.v1')).toBe(true)
    expect(raw.includes('Public committed')).toBe(true)
    expect(raw.includes('Private local-only')).toBe(true)
  })
})
