#!/usr/bin/env node
/*
 * validate-engineering-skills.cjs — structural validator for the Engineering-OS skills.
 *
 * Asserts each required skill dir has a SKILL.md with frontmatter (name + description),
 * and that the 7 Foundation-Release-1 skills contain every mandatory section. release-gate
 * is a PRE-EXISTING skill (reused, not recreated) so it is only checked for presence + frontmatter.
 *
 * Evidence class: CODE (deterministic). Exit 0 = all valid, exit 1 = a violation.
 */
'use strict'
const fs = require('fs')
const path = require('path')

const SKILLS_DIR = path.resolve(__dirname, '..', '.claude', 'skills')

const NEW_SKILLS = [
  'system-discovery', 'grill-me', 'production-reality', 'gold-replay',
  'failure-to-regression', 'preview-verification', 'incident-report',
]
const REUSED_SKILLS = ['release-gate'] // pre-existing, reused

const MANDATORY_SECTIONS = [
  '## Purpose', '## Trigger', '## Inputs', '## Evidence classes', '## Process',
  '## Tools', '## Forbidden', '## Output schema', '## Stop conditions',
  '## Completion criteria', '## Context policy',
]

function readSkill(name) {
  const p = path.join(SKILLS_DIR, name, 'SKILL.md')
  if (!fs.existsSync(p)) return { p, missing: true }
  return { p, missing: false, text: fs.readFileSync(p, 'utf8') }
}

function hasFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return false
  return /\bname:\s*\S+/.test(m[1]) && /\bdescription:\s*\S+/.test(m[1])
}

let failures = 0
const report = []

for (const name of NEW_SKILLS) {
  const s = readSkill(name)
  if (s.missing) { report.push(`❌ ${name}: SKILL.md missing`); failures++; continue }
  const problems = []
  if (!hasFrontmatter(s.text)) problems.push('frontmatter name/description')
  for (const sec of MANDATORY_SECTIONS) if (!s.text.includes(sec)) problems.push(`section "${sec}"`)
  if (problems.length) { report.push(`❌ ${name}: missing ${problems.join(', ')}`); failures++ }
  else report.push(`✅ ${name}: complete (${MANDATORY_SECTIONS.length} sections)`)
}

for (const name of REUSED_SKILLS) {
  const s = readSkill(name)
  if (s.missing) { report.push(`❌ ${name}: expected pre-existing skill missing`); failures++; continue }
  if (!hasFrontmatter(s.text)) { report.push(`❌ ${name}: frontmatter name/description missing`); failures++ }
  else report.push(`✅ ${name}: present (reused, pre-existing)`)
}

console.log('Engineering-OS skill structural validation')
console.log('==========================================')
for (const line of report) console.log(line)
console.log('------------------------------------------')
if (failures) { console.error(`FAILED: ${failures} skill(s) invalid.`); process.exit(1) }
console.log(`PASSED: ${NEW_SKILLS.length} new + ${REUSED_SKILLS.length} reused skill(s) valid.`)
