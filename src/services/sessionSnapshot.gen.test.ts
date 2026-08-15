/*
 * sessionSnapshot.gen.test.ts — regenerate docs/eval/SESSION_CONFIG_SNAPSHOT.json from the CURRENT
 * buildSessionUpdate() on every build. The real-model instrument (scripts/golden + scripts/probes)
 * reads that snapshot; before this, it was a hand dump that could silently drift from the deployed
 * instructions (a tested-vs-deployed gap, Part 5). Now the instrument always tests what ships.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { buildSessionUpdate } from './liveSession'

describe('session config snapshot generation (instrument tracks the real instructions)', () => {
  it('writes SESSION_CONFIG_SNAPSHOT.json from buildSessionUpdate (no stale-dump drift)', () => {
    // Fixed clock → deterministic snapshot (only the "# Today" line depends on it).
    const update = buildSessionUpdate(Date.parse('2026-08-16T09:00:00Z')) as { session: Record<string, unknown> }
    const session = update.session
    const out = path.resolve(process.cwd(), 'docs/eval/SESSION_CONFIG_SNAPSHOT.json')
    fs.writeFileSync(out, JSON.stringify(session, null, 2) + '\n')
    expect(typeof session.instructions).toBe('string')
    expect((session.instructions as string).length).toBeGreaterThan(1000)
    expect(Array.isArray(session.tools)).toBe(true)
    // The calendar-decisiveness nudge (Part 3 finding) must be present in what the instrument tests.
    expect(session.instructions as string).toContain('prepare_calendar_event RIGHT AWAY')
  })
})
