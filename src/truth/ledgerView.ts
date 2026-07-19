/*
 * LEDGER VIEW — the canonical human-readable Hebrew file, regenerated from state.
 * "File-as-view": never hand-edited; always a projection of the ledger + change log.
 */
import type { Ledger } from './familyLaws'
import type { LogEntry } from './ledgerService'

const GENDER_HE: Record<string, string> = { male: 'זכר', female: 'נקבה', unknown: '' }

export function renderLedgerHebrew(ledger: Ledger, log: LogEntry[] = []): string {
  const people = [...ledger.values()].sort((a, b) => a.name.localeCompare(b.name, 'he'))
  const lines: string[] = ['# פנקס המשפחה של Martita', '', `_נוצר מהמצב — ${people.length} אנשים, ${log.length} שינויים. אל תערכי ידנית._`, '', '## אנשים']
  for (const p of people) {
    const g = GENDER_HE[p.gender] ? ` (${GENDER_HE[p.gender]})` : ''
    lines.push(`### ${p.name}${g}${p.birthdate ? ` · נולד/ה ${p.birthdate}` : ''}`)
    if (p.parents.length) lines.push(`- הורים: ${p.parents.join(', ')}`)
    if (p.spouses.length) lines.push(`- בן/בת זוג: ${p.spouses.join(', ')}`)
    if (p.exSpouses.length) lines.push(`- לשעבר: ${p.exSpouses.join(', ')}`)
    const alias = p.aliases.filter((a) => a && a !== p.name)
    if (alias.length) lines.push(`- ידועה גם כ: ${alias.join(', ')}`)
  }
  lines.push('', '## יומן שינויים')
  if (!log.length) lines.push('- (אין שינויים עדיין)')
  for (const e of log) lines.push(`- ${e.line} — ${e.source}`)
  lines.push('')
  return lines.join('\n')
}
