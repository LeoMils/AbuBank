import { useCallback, useEffect, useRef, useState } from 'react'
import { hasPin, setPin as persistPin, verifyPin, writeLockConfig } from '../../services/appLock'
import {
  enrollBiometric,
  isBiometricEnrolled,
  isPlatformBiometricAvailable,
  verifyBiometric,
} from '../../services/biometricAuth'
import { authStatus, passkeyLogin, passkeyRegister } from '../../services/serverAuth'
import styles from './AuthGate.module.css'

type Mode = 'unlock' | 'setup'

interface AuthGateProps {
  mode: Mode
  /** Called ONLY on genuine success: a verified passkey/biometric, a valid PIN,
   *  or a completed first-run setup. No path calls this on an auth failure. */
  onAuthed: () => void
}

const PIN_LEN = 4

/**
 * The Abu Ela lock — FAIL-CLOSED, and now backed by SERVER-VERIFIED passkeys.
 *
 * When the server has auth configured and this device is enrolled, the biometric
 * gesture IS a WebAuthn assertion (Face ID) that the server verifies and answers
 * with a session — so the billable APIs accept the device. The local PIN remains
 * the fallback that unlocks the UI (a wrong PIN stays locked, a subsystem error
 * is treated as failure — never an open); a PIN-only unlock does NOT mint a
 * server session, so billable features stay unauthenticated until a passkey
 * succeeds. If server auth is unconfigured or the platform lacks an
 * authenticator, it degrades to the local-only lock.
 *
 * setup (first run): establish a PIN (mandatory, no "Later"), then — if the
 * server is configured — offer owner-bootstrapped passkey enrollment (the owner
 * enters a one-time activation code); otherwise offer local biometric enroll.
 */
export function AuthGate({ mode, onAuthed }: AuthGateProps) {
  type Step = 'loading' | 'bioUnlock' | 'pinEnter' | 'pinSet' | 'pinConfirm' | 'enroll' | 'bioOffer'
  const [step, setStep] = useState<Step>(mode === 'setup' ? 'pinSet' : 'loading')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [bioAvailable, setBioAvailable] = useState(false)
  const serverConfigured = useRef(false)
  const serverEnrolled = useRef(false)
  const authedRef = useRef(false)
  const pendingPin = useRef('')

  const finish = useCallback(() => {
    if (authedRef.current) return
    authedRef.current = true
    onAuthed()
  }, [onAuthed])

  // Discover server auth + platform capability once.
  useEffect(() => {
    let alive = true
    void (async () => {
      const [s, a] = await Promise.all([authStatus(), isPlatformBiometricAvailable()])
      if (!alive) return
      serverConfigured.current = s.configured
      serverEnrolled.current = s.enrolled
      setBioAvailable(a)
      if (mode === 'unlock') {
        if (s.authed) {
          finish()
          return
        }
        const canBio = (s.configured && s.enrolled) || isBiometricEnrolled()
        setStep(canBio ? 'bioUnlock' : 'pinEnter')
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── UNLOCK: passkey (server session) if enrolled, else local biometric; then PIN. ──
  const runBiometric = useCallback(async () => {
    setError('')
    setStatus('מזהה אותך…')
    let ok = false
    if (serverConfigured.current && serverEnrolled.current) {
      ok = (await passkeyLogin()) === 'ok'
    } else {
      ok = (await verifyBiometric()) === 'ok'
    }
    if (ok) {
      finish()
      return
    }
    setStatus('')
    if (hasPin()) {
      setStep('pinEnter')
      setError('לא זיהיתי. אפשר להיכנס עם הקוד.')
    } else {
      setError('לא הצלחתי לזהות. נסי שוב.')
    }
  }, [finish])

  useEffect(() => {
    if (step === 'bioUnlock') void runBiometric()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  // After the PIN is set (setup): enrol a passkey (owner code) if the server is
  // configured; else offer local biometric; else just enter.
  const afterPinSet = useCallback(() => {
    setError('')
    setStatus('')
    if (serverConfigured.current) setStep('enroll')
    else if (bioAvailable) setStep('bioOffer')
    else finish()
  }, [bioAvailable, finish])

  return (
    <div className={styles.root} data-testid="auth-gate" dir="rtl">
      <div className={styles.grain} aria-hidden="true" />
      <div className={styles.card}>
        <div className={styles.brand} aria-hidden="true">
          Abu Ela
        </div>

        {step === 'loading' && <p className={styles.status}>רגע…</p>}

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
              const okPin = await verifyPin(code) // guarded; false on any error → fail-closed
              if (okPin) {
                // Local unlock succeeded. Opportunistically obtain a server session
                // if this device is passkey-enrolled (transparent; never blocks entry).
                if (serverConfigured.current && serverEnrolled.current) void passkeyLogin()
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

        {step === 'enroll' && (
          <DeviceActivationStep
            onActivated={() => { writeLockConfig({ biometricEnrolled: true, protectionEnabled: true }); finish() }}
            onRestricted={finish}
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
            onSkip={finish}
          />
        )}
      </div>
    </div>
  )
}

// ── biometric unlock view (passkey or local) ─────────────────────────────────
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

// ── DEVICE ACTIVATION (owner/Leo, one-time) — deliberately distinct from Martita's PIN ──
// The physical-device escape (Leo, iPhone): the user confused the activation code with
// their just-set PIN and then "continued with code only" into a full-looking app with NO
// server session. This step is now unmistakably an OWNER action, and skipping it enters an
// explicit RESTRICTED state (never a false success). See entryStateMachine.test.ts.
function DeviceActivationStep({ onActivated, onRestricted }: { onActivated: () => void; onRestricted: () => void }) {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const activate = async () => {
    if (busy || !code.trim()) return
    setBusy(true)
    setError('')
    setStatus('מפעילה את המכשיר…')
    const r = await passkeyRegister(code.trim())
    setStatus('')
    setBusy(false)
    if (r === 'ok') return onActivated()
    if (r === 'denied') setError('קוד הפעלה לא נכון (זה לא הקוד של מרתה)')
    else if (r === 'cancelled') setError('')
    else if (r === 'unavailable') setError('המכשיר הזה לא תומך בהפעלה מאובטחת')
    else if (r === 'not-configured') setError('הפעלה מאובטחת עדיין לא מוגדרת בשרת')
    else setError('לא הצליח, נסו שוב')
  }

  return (
    <>
      <div className={styles.ownerBadge}>הפעלה חד-פעמית · לאו</div>
      <p className={styles.status}>הפעלת המכשיר</p>
      <p className={styles.sub}>זו פעולה של לאו — קוד ההפעלה שונה מהקוד של מרתה</p>
      <input
        className={styles.codeInput}
        type="password"
        inputMode="text"
        autoComplete="off"
        placeholder="קוד הפעלה מלאו"
        value={code}
        onChange={(e) => { setCode(e.target.value); setError('') }}
        dir="ltr"
      />
      {error && <p className={styles.error}>{error}</p>}
      <button className={styles.primary} onClick={() => void activate()} disabled={busy}>
        הפעלה עם זיהוי פנים
      </button>
      <button className={styles.ghost} onClick={onRestricted}>
        כניסה מוגבלת בינתיים (בלי הפעלה)
      </button>
    </>
  )
}

// ── local biometric enroll offer (fallback when the server has no auth) ───────
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
