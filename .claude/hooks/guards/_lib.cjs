'use strict'
/*
 * Shared helpers for Abu Engineering-OS hook guards.
 * Emergency disable: set ABU_HOOKS_DISABLE=1 to make every guard no-op (exit 0).
 * All guards are fail-safe: any internal error → allow (never brick the session).
 */
const fs = require('fs')
const path = require('path')

const DISABLED = process.env.ABU_HOOKS_DISABLE === '1'

function readStdin() {
  try { return fs.readFileSync(0, 'utf8') } catch { return '' }
}

function parseInput() {
  let raw = readStdin()
  // Strip a leading UTF-8 BOM (some shells/pipes prepend one) before parsing.
  if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1)
  raw = raw.trim()
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

function projectDir() {
  return process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..', '..', '..')
}

module.exports = { DISABLED, parseInput, projectDir, fs, path }
