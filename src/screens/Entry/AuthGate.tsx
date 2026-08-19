import { useCallback, useEffect, useRef, useState } from 'react'
import {
  hasPin,
  setPin as persistPin,
  verifyPin,
  writeLockConfig,
} from '../../services/appLock'
import {
  enrollBiometric,
  isBiometricEnrolled,
  isPlatformBiometricAvailable,
  verifyBiometric,
} from '../../services/biometricAuth'
import styles from './AuthGate.module.css'

type Mode = 'unlock' | 'setup'

interface AuthGateProps {
  mode: Mode
  /** Called once the user is authenticated (or opts out of first-run setup). */
  onAuthed: () => void
}

const PIN_LEN = 4

/** A calm, high-contrast biometric-first lock. PIN is the always-works backup. */
export function AuthGate({ mode, onAuthed }: AuthGateProps) {
  const [view, setView] = useState<'bio' | 'pin' | 'choose'>(
    mode === 'setup' ? 'choose' : isBiometricEnrolled() ? 'bio' : 'pin',
  )
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [bioAvailable, setBioAvailable] = useState(false)
  const authedRef = useRef(false)

  const finish = useCallback(() => {
    if (authedRef.current) return
    authedRef.current = true
    onAuthed()
  }, [onAuthed])

  useEffect(() => {
    let alive = true
    void isPlatformBiometricAvailable().then((a) => {
      if (alive) setBioAvailable(a)
    })
    return () => {
      alive = false
    }
  }, [])

  // ── UNLOCK: try the platform biometric immediately, then fall back to PIN ──
  const runBiometric = useCallback(async () => {
    setError('')
    setStatus('מזהה אותך…')
    const r = await verifyBiometric()
    if (r === 'ok') {
      finish()
      return
    }
    // Fall back gracefully. If we genuinely cannot use biometrics and there is
    // no PIN, degrade OPEN rather than trap the user (fail-open by design).
    if (hasPin()) {
      setView('pin')
      setStatus('')
      if (r === 'cancelled') setError('')
      else setError('לא הצלחתי לזהות. אפשר להיכנס עם הקוד.')
    } else if (r === 'unavailable') {
      finish()
    } else {
      setStatus('')
      setError('לא הצלחתי לזהות. נסי שוב.')
    }
  }, [finish])

  useEffect(() => {
    if (mode === 'unlock' && view === 'bio') void runBiometric()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.root} data-testid="auth-gate" dir="rtl">
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.card}>
        <div className={styles.brand} aria-hidden="true">
          Abu Ela
        </div>

        {view === 'bio' && (
          <BiometricView
            status={status}
            error={error}
            onRetry={() => void runBiometric()}
            {...(hasPin() ? { onUsePin: () => { setError(''); setView('pin') } } : {})}
          />
        )}

        {view === 'pin' && (
          <PinView
            mode={mode === 'setup' ? 'set' : 'enter'}
            onDone={finish}
          />
        )}

        {view === 'choose' && (
          <SetupChoose
            bioAvailable={bioAvailable}
            onEnableBiometric={async () => {
              setError('')
              setStatus('מפעילה זיהוי פנים…')
              const r = await enrollBiometric()
              setStatus('')
              if (r.ok) {
                writeLockConfig({ biometricEnrolled: true, protectionEnabled: true, setupPromptSeen: true })
                // Offer a backup PIN (recommended), skippable.
                setView('pin')
              } else if (r.reason === 'cancelled') {
                setError('')
              } else {
                setError('לא הצלחתי להפעיל זיהוי פנים במכשיר הזה.')
              }
            }}
            onSetPin={() => { setError(''); setView('pin') }}
            onLater={() => {
              writeLockConfig({ setupPromptSeen: true })
              finish()
            }}
            status={status}
            error={error}
          />
        )}
      </div>
    </div>
  )
}

// ── biometric view ──────────────────────────────────────────────────────────
function BiometricView({
  status,
  error,
  onRetry,
  onUsePin,
}: {
  status: string
  error: string
  onRetry: () => void
  onUsePin?: () => void
}) {
  return (
    <>
      <FaceGlyph />
      <p className={styles.status}>{status || 'הביטי במסך לכניסה'}</p>
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.primary} onClick={onRetry}>
        כניסה עם זיהוי פנים
      </button>
      {onUsePin && (
        <button className={styles.ghost} onClick={onUsePin}>
          כניסה עם קוד
        </button>
      )}
    </>
  )
}

// ── PIN view (enter existing, or set + confirm) ──────────────────────────────
function PinView({ mode, onDone }: { mode: 'enter' | 'set'; onDone: () => void }) {
  // 'set' walks set → confirm; 'enter' verifies the stored PIN.
  const [stage, setStage] = useState<'enter' | 'set' | 'confirm'>(mode === 'set' ? 'set' : 'enter')
  const [first, setFirst] = useState('')
  const [digits, setDigits] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const title =
    stage === 'enter' ? 'הזיני את הקוד' : stage === 'set' ? 'בחרי קוד בן 4 ספרות' : 'הזיני שוב לאישור'

  const submit = useCallback(
    async (code: string) => {
      setBusy(true)
      try {
        if (stage === 'enter') {
          const ok = await verifyPin(code)
          if (ok) return onDone()
          setError('הקוד לא נכון, נסי שוב')
          setDigits('')
        } else if (stage === 'set') {
          setFirst(code)
          setDigits('')
          setError('')
          setStage('confirm')
        } else {
          if (code === first) {
            const ok = await persistPin(code)
            if (ok) return onDone()
            setError('לא הצלחתי לשמור את הקוד')
            setDigits('')
            setStage('set')
          } else {
            setError('הקודים לא תואמים, ננסה שוב')
            setDigits('')
            setFirst('')
            setStage('set')
          }
        }
      } finally {
        setBusy(false)
      }
    },
    [stage, first, onDone],
  )

  const press = (d: string) => {
    if (busy || digits.length >= PIN_LEN) return
    const next = digits + d
    setDigits(next)
    setError('')
    if (next.length === PIN_LEN) void submit(next)
  }
  const back = () => setDigits((d) => d.slice(0, -1))

  return (
    <>
      <p className={styles.status}>{title}</p>
      {/* Numeric pad is LTR even in Hebrew — phone keypads are never mirrored. */}
      <div className={styles.dots} dir="ltr" aria-hidden="true">
        {Array.from({ length: PIN_LEN }).map((_, i) => (
          <span key={i} className={`${styles.dot} ${i < digits.length ? styles.dotOn : ''}`} />
        ))}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.keypad} dir="ltr">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className={styles.key} onClick={() => press(d)} aria-label={d}>
            {d}
          </button>
        ))}
        <span />
        <button className={styles.key} onClick={() => press('0')} aria-label="0">
          0
        </button>
        <button className={`${styles.key} ${styles.keyAux}`} onClick={back} aria-label="מחיקה">
          ⌫
        </button>
      </div>
      {mode === 'set' && (
        <button className={styles.ghost} onClick={onDone}>
          דלגי בינתיים
        </button>
      )}
    </>
  )
}

// ── first-run setup choices ──────────────────────────────────────────────────
function SetupChoose({
  bioAvailable,
  onEnableBiometric,
  onSetPin,
  onLater,
  status,
  error,
}: {
  bioAvailable: boolean
  onEnableBiometric: () => void
  onSetPin: () => void
  onLater: () => void
  status: string
  error: string
}) {
  return (
    <>
      <FaceGlyph />
      <p className={styles.status}>הגנה על Abu Ela</p>
      <p className={styles.sub}>כדי לשמור על הפרטיות שלך</p>
      {status && <p className={styles.status}>{status}</p>}
      {error && <p className={styles.error}>{error}</p>}
      {bioAvailable && (
        <button className={styles.primary} onClick={onEnableBiometric}>
          הפעלת זיהוי פנים
        </button>
      )}
      <button className={bioAvailable ? styles.secondary : styles.primary} onClick={onSetPin}>
        הגדרת קוד סודי
      </button>
      <button className={styles.ghost} onClick={onLater}>
        אחר כך
      </button>
    </>
  )
}

// A restrained, geometric face glyph — no photorealism, no gimmick.
function FaceGlyph() {
  return (
    <svg className={styles.face} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="56" height="56" rx="16" stroke="currentColor" strokeWidth="2.5" opacity="0.85" />
      <path d="M4 20V16a12 12 0 0 1 12-12h4M44 4h4a12 12 0 0 1 12 12v4M60 44v4a12 12 0 0 1-12 12h-4M20 60h-4A12 12 0 0 1 4 48v-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="24" cy="27" r="2.6" fill="currentColor" />
      <circle cx="40" cy="27" r="2.6" fill="currentColor" />
      <path d="M25 41c2.2 2.4 4.6 3.6 7 3.6s4.8-1.2 7-3.6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}
