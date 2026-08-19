import { useCallback, useEffect, useRef, useState } from 'react'
import { hasPin, setPin as persistPin, verifyPin, writeLockConfig } from '../../services/appLock'
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
  /** Called ONLY on genuine success: biometric verified, or a valid PIN, or a
   *  completed first-run setup. There is no path that calls this on failure. */
  onAuthed: () => void
}

const PIN_LEN = 4

/**
 * The Abu Ela lock — FAIL-CLOSED.
 *
 * unlock: biometric (if enrolled) runs first; on anything other than success it
 * falls back to the PIN. A wrong PIN stays locked; a subsystem error is treated
 * as a failure (never an open). `onAuthed` fires only on real success.
 *
 * setup (first run, MANDATORY): establish a PIN (set + confirm) — this is the
 * floor, there is no "Later". If the platform supports biometrics we then offer
 * to enroll Face ID/Touch ID (skippable, because the PIN already protects the
 * app). If biometrics are unavailable, the PIN alone is sufficient.
 */
export function AuthGate({ mode, onAuthed }: AuthGateProps) {
  type Step = 'bioUnlock' | 'pinEnter' | 'pinSet' | 'pinConfirm' | 'bioOffer'
  const initialStep: Step =
    mode === 'setup' ? 'pinSet' : isBiometricEnrolled() ? 'bioUnlock' : 'pinEnter'

  const [step, setStep] = useState<Step>(initialStep)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [bioAvailable, setBioAvailable] = useState(false)
  const authedRef = useRef(false)
  // Holds the first PIN across the set → confirm steps (never rendered).
  const pendingPin = useRef('')

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

  // ── UNLOCK: platform biometric first, then PIN. Never opens on failure. ──
  const runBiometric = useCallback(async () => {
    setError('')
    setStatus('מזהה אותך…')
    const r = await verifyBiometric()
    if (r === 'ok') {
      finish()
      return
    }
    setStatus('')
    // Every non-success path falls to the PIN — a protected device always has one.
    if (hasPin()) {
      setStep('pinEnter')
      setError(r === 'cancelled' ? '' : 'לא זיהיתי. אפשר להיכנס עם הקוד.')
    } else {
      // Should be unreachable (setup always sets a PIN). Stay locked, never open.
      setError('לא הצלחתי לזהות. נסי שוב.')
    }
  }, [finish])

  useEffect(() => {
    if (step === 'bioUnlock') void runBiometric()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After the PIN is set (setup), enroll biometrics if the platform supports it.
  const afterPinSet = useCallback(() => {
    if (bioAvailable) {
      setError('')
      setStatus('')
      setStep('bioOffer')
    } else {
      finish()
    }
  }, [bioAvailable, finish])

  return (
    <div className={styles.root} data-testid="auth-gate" dir="rtl">
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.card}>
        <div className={styles.brand} aria-hidden="true">
          Abu Ela
        </div>

        {step === 'bioUnlock' && (
          <BiometricUnlock
            status={status}
            error={error}
            onRetry={() => void runBiometric()}
            {...(hasPin() ? { onUsePin: () => { setError(''); setStatus(''); setStep('pinEnter') } } : {})}
          />
        )}

        {step === 'pinEnter' && (
          <PinPad
            title="הזיני את הקוד"
            onSubmit={async (code) => {
              // verifyPin is guarded and returns false on any error → fail-closed.
              const ok = await verifyPin(code)
              if (ok) {
                finish()
                return { ok: true }
              }
              return { ok: false, message: 'הקוד לא נכון, נסי שוב' }
            }}
          />
        )}

        {step === 'pinSet' && (
          <PinPad
            key="set"
            title="בחרי קוד בן 4 ספרות"
            sub="הקוד ישמור על Abu Ela"
            onSubmit={async (code) => {
              pendingPin.current = code
              setStep('pinConfirm')
              return { ok: true }
            }}
          />
        )}

        {step === 'pinConfirm' && (
          <PinPad
            key="confirm"
            title="הזיני שוב לאישור"
            onSubmit={async (code) => {
              if (code !== pendingPin.current) {
                pendingPin.current = ''
                setStep('pinSet')
                return { ok: false, message: 'הקודים לא תואמים, ננסה שוב' }
              }
              const saved = await persistPin(code)
              if (!saved) {
                setStep('pinSet')
                return { ok: false, message: 'לא הצלחתי לשמור, ננסה שוב' }
              }
              afterPinSet()
              return { ok: true }
            }}
          />
        )}

        {step === 'bioOffer' && (
          <BiometricOffer
            status={status}
            error={error}
            onEnable={async () => {
              setError('')
              setStatus('מפעילה זיהוי פנים…')
              const r = await enrollBiometric()
              setStatus('')
              if (r.ok) {
                writeLockConfig({ biometricEnrolled: true, protectionEnabled: true })
                finish()
              } else if (r.reason === 'cancelled') {
                setError('')
              } else {
                setError('לא הצלחתי להפעיל זיהוי פנים במכשיר הזה.')
              }
            }}
            // Skipping biometrics is safe — the PIN already protects the app.
            onSkip={finish}
          />
        )}
      </div>
    </div>
  )
}

// ── biometric unlock view ────────────────────────────────────────────────────
function BiometricUnlock({
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

// ── biometric enroll offer (setup only; PIN already set) ─────────────────────
function BiometricOffer({
  status,
  error,
  onEnable,
  onSkip,
}: {
  status: string
  error: string
  onEnable: () => void
  onSkip: () => void
}) {
  return (
    <>
      <FaceGlyph />
      <p className={styles.status}>להיכנס עם זיהוי פנים?</p>
      <p className={styles.sub}>מהיר יותר מהקוד — הקוד יישאר לגיבוי</p>
      {status && <p className={styles.status}>{status}</p>}
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.primary} onClick={onEnable}>
        הפעלת זיהוי פנים
      </button>
      <button className={styles.ghost} onClick={onSkip}>
        להמשיך עם הקוד
      </button>
    </>
  )
}

// ── reusable numeric pad ─────────────────────────────────────────────────────
type SubmitResult = { ok: boolean; message?: string }
function PinPad({
  title,
  sub,
  onSubmit,
}: {
  title: string
  sub?: string
  onSubmit: (code: string) => Promise<SubmitResult>
}) {
  const [digits, setDigits] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const press = (d: string) => {
    if (busy || digits.length >= PIN_LEN) return
    const next = digits + d
    setDigits(next)
    setError('')
    if (next.length === PIN_LEN) {
      setBusy(true)
      void onSubmit(next)
        .then((r) => {
          if (!r.ok) {
            setDigits('')
            if (r.message) setError(r.message)
          }
        })
        .catch(() => {
          // Any handler error is a failure — clear + stay, never proceed.
          setDigits('')
          setError('משהו השתבש, נסי שוב')
        })
        .finally(() => setBusy(false))
    }
  }
  const back = () => setDigits((d) => d.slice(0, -1))

  return (
    <>
      <p className={styles.status}>{title}</p>
      {sub && <p className={styles.sub}>{sub}</p>}
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
