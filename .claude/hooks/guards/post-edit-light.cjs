#!/usr/bin/env node
'use strict'
/*
 * PostToolUse light guard (matcher: Edit|Write). Non-blocking. Scans the edited
 * file for an accidental secret/phone leak and prints an advisory. Never fails a
 * tool call (always exit 0). Disable: ABU_HOOKS_DISABLE=1.
 */
const { DISABLED, parseInput, fs } = require('./_lib.cjs')

try {
  if (DISABLED) process.exit(0)
  const input = parseInput()
  const fp = String((input.tool_input || input.toolInput || {}).file_path ||
                     (input.tool_input || input.toolInput || {}).filePath || '')
  if (!fp || !fs.existsSync(fp)) process.exit(0)
  // Skip tests/docs/examples (they legitimately mention key names / sample numbers).
  if (/\.(test|spec)\.[tj]sx?$/.test(fp) || /\.example$/.test(fp) || /[\\/]docs[\\/]/.test(fp)) process.exit(0)

  let txt = ''
  try { txt = fs.readFileSync(fp, 'utf8') } catch { process.exit(0) }

  const warnings = []
  if (/sk-[A-Za-z0-9_-]{20,}/.test(txt)) warnings.push('a possible OpenAI-style secret token (sk-…)')
  if (/\bimport\.meta\.env\.VITE_OPENAI_API_KEY\b/.test(txt)) warnings.push('a client read of the billable VITE_OPENAI_API_KEY (server-only!)')
  if (/(^|[^0-9])\+9725\d{8}([^0-9]|$)/.test(txt) || /(^|[^0-9])05\d{8}([^0-9]|$)/.test(txt)) warnings.push('what looks like a real phone number (privacy)')

  if (warnings.length) {
    process.stdout.write(`⚠️  Abu post-edit advisory for ${fp}:\n` +
      warnings.map((w) => `   - ${w}`).join('\n') +
      `\n   Review before committing (see .claude/rules/privacy.md).\n`)
  }
  process.exit(0)
} catch (_e) {
  process.exit(0)
}
