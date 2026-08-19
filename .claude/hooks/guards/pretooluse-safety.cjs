#!/usr/bin/env node
'use strict'
/*
 * PreToolUse safety guard (matcher: Bash).
 * Blocks (exit 2 + stderr reason) genuinely dangerous shell actions. Everything
 * else is allowed (exit 0). Fail-safe: any error or unparseable input → allow.
 * Emergency disable: ABU_HOOKS_DISABLE=1.
 *
 * Contract: PreToolUse hook. exit 2 = block, stderr shown to the model. exit 0 = allow.
 */
const { DISABLED, parseInput } = require('./_lib.cjs')

function block(reason) {
  process.stderr.write(`⛔ Abu safety guard blocked this command.\n${reason}\n` +
    `If this is truly intended, run it yourself in a terminal, or set ABU_HOOKS_DISABLE=1.\n`)
  process.exit(2)
}

try {
  if (DISABLED) process.exit(0)
  const input = parseInput()
  const tool = input.tool_name || input.toolName || ''
  if (!/^Bash$/i.test(tool)) process.exit(0)
  const cmd = String((input.tool_input || input.toolInput || {}).command || '')
  if (!cmd.trim()) process.exit(0)
  const c = cmd.replace(/\s+/g, ' ').trim()

  // 1) git add -A / --all / bare "git add ." (too broad — stage explicitly)
  if (/\bgit\s+add\s+(-A\b|--all\b|\.\s*$|\.\s*&|\.\s*;)/.test(c) || /\bgit\s+add\s+-A\b/.test(c))
    block('`git add -A/--all/.` stages everything (product edits, generated data, logs). Stage only intended files explicitly.')

  // 2) force push
  if (/\bgit\s+push\b[^\n]*(--force\b|-f\b|--force-with-lease\b)/.test(c))
    block('Force-push can destroy remote history. Push a normal update, or do it manually if truly intended.')

  // 3) destructive reset/clean
  if (/\bgit\s+reset\s+--hard\b/.test(c)) block('`git reset --hard` discards work. Confirm manually.')
  if (/\bgit\s+clean\s+-[a-z]*f/.test(c)) block('`git clean -f` deletes untracked files. Confirm manually.')

  // 4) production deploy
  if (/\bvercel\b[^\n]*--prod\b/.test(c) || /\bvercel\s+deploy\b[^\n]*--prod\b/.test(c))
    block('Production deploy is blocked. Deploys require explicit human approval (never autonomous).')

  // 5) staging secrets / private data
  if (/\bgit\s+add\b[^\n]*(\.env(\b|\.[a-z]+)|[^\s]*\.local\.json|[^\s]*\.private\.json|(^|\s|\/)private\/)/.test(c))
    block('Refusing to stage secrets/private data (.env, *.local.json, *.private.json, private/).')

  // 6) reading a real .env file (printing secrets) — only .env.example is allowed
  const envRead = c.match(/\b(?:cat|type|Get-Content|gc|less|more|bat)\b\s+[^\n]*?(\.env(?:\.[A-Za-z]+)?)\b/)
  if (envRead && envRead[1].toLowerCase() !== '.env.example')
    block(`Refusing to print ${envRead[1]} (may contain live secrets). Use .env.example.`)

  process.exit(0)
} catch (_e) {
  // Fail-safe: never block on a guard bug.
  process.exit(0)
}
