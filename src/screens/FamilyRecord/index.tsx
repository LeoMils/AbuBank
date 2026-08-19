/*
 * תעודת המשפחה — the family-record screen (LEDGER EXPANSION v3).
 * Renders the canonical Hebrew ledger (renderLedgerHebrew, with provenance), lets Leo paste
 * free text that runs through extractChange → a one-line accept/reject DIFF (each fact
 * committed on tap through THE LAWS gate), export a backup, and UNDO the last change.
 * Senior-safe: large text, plain Hebrew, RTL. Reuses the ledger engine — no parallel path.
 */
import { useRef, useState } from 'react'
import { useAppStore } from '../../state/store'
import { Screen } from '../../state/types'
import { BackButton } from '../../components/BackButton'
import { LedgerService, localLedgerStore } from '../../truth/ledgerService'
import { parseFreeText, commitProposal, type Proposal } from './familyRecordLogic'

const BG = '#050A18'
const GOLD = '#C9A84C'

export function FamilyRecord() {
  const setScreen = useAppStore((s) => s.setScreen)
  const svcRef = useRef<LedgerService | null>(null)
  if (!svcRef.current) svcRef.current = new LedgerService(localLedgerStore())
  const svc = svcRef.current
  const [, setTick] = useState(0)
  const refresh = () => setTick((t) => t + 1)

  const [paste, setPaste] = useState('')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [results, setResults] = useState<Record<number, string>>({})

  function check() { setProposals(parseFreeText(paste)); setResults({}) }
  function commit(i: number, p: Proposal) {
    if (!p.change) return
    const r = commitProposal(svc, p.change, Date.now())
    setResults((x) => ({ ...x, [i]: r.line }))
    refresh()
  }
  function exportBackup() {
    try {
      const data = JSON.stringify({ log: svc.getLog(), rendered: svc.renderHebrew() }, null, 2)
      const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }))
      const a = document.createElement('a'); a.href = url; a.download = 'abu-family-record.json'
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
    } catch { /* export must never break the screen */ }
  }
  function undo() { svc.undo(); refresh() }

  const view = svc.renderHebrew()
  const btn = (bg: string, color: string): React.CSSProperties => ({ minHeight: 48, padding: '10px 18px', borderRadius: 12, border: 'none', background: bg, color, fontSize: 16, fontWeight: 700, fontFamily: "'Heebo',sans-serif", cursor: 'pointer' })

  return (
    <div dir="rtl" style={{ minHeight: '100dvh', background: BG, color: 'white', display: 'flex', flexDirection: 'column', padding: '14px 14px 40px', fontFamily: "'Heebo',sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <BackButton onPress={() => setScreen(Screen.Settings)} />
        <div style={{ fontSize: 22, fontWeight: 800, color: GOLD }}>תעודת המשפחה</div>
      </div>

      {/* The canonical Hebrew ledger — regenerated from state, with provenance. */}
      <div
        data-testid="family-record-view"
        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(201,168,76,0.22)', borderRadius: 14, padding: 14, whiteSpace: 'pre-wrap', direction: 'rtl', fontSize: 15, lineHeight: 1.7, maxHeight: '46vh', overflow: 'auto' }}
      >{view}</div>

      {/* Paste free text → check → per-fact accept/reject diff, committed on tap. */}
      <div style={{ marginTop: 16, fontSize: 16, fontWeight: 700 }}>הוספת פרטים (הדביקי טקסט חופשי)</div>
      <textarea
        data-testid="family-record-paste"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        placeholder={'למשל:\nדני גר בתל אביב\nרותי היא אשתו של דני'}
        style={{ marginTop: 6, minHeight: 90, width: '100%', boxSizing: 'border-box', borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: 'white', padding: 12, fontSize: 16, fontFamily: "'Heebo',sans-serif", direction: 'rtl' }}
      />
      <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        <button type="button" data-testid="family-record-check" onClick={check} style={btn('rgba(201,168,76,0.16)', '#FFE9B3')}>בדקי</button>
        <button type="button" data-testid="family-record-export" onClick={exportBackup} style={btn('transparent', 'rgba(255,255,255,0.7)')}>ייצוא גיבוי</button>
        <button type="button" data-testid="family-record-undo" onClick={undo} style={btn('transparent', 'rgba(255,255,255,0.7)')}>ביטול שינוי אחרון</button>
      </div>

      {proposals.length > 0 && (
        <div data-testid="family-record-diff" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {proposals.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 12px' }}>
              <div style={{ flex: 1, minWidth: 0, fontSize: 15 }}>{results[i] ?? p.label}</div>
              {p.change && !results[i] && (
                <button type="button" data-testid={`family-record-commit-${i}`} onClick={() => commit(i, p)} style={btn('rgba(20,184,166,0.20)', '#2DD4BF')}>רשמי</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
