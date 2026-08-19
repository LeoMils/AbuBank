import { useEffect, useState } from 'react'
import { authStatus, deriveRestricted, passkeyLogin } from '../../services/serverAuth'
import styles from './RestrictedBanner.module.css'

/*
 * RestrictedBanner — the honest "not fully activated" indicator. (Item 4)
 * ════════════════════════════════════════════════════════════════════════════
 * The physical-device escape: a PIN-only entry made the full app LOOK operational
 * while no server session existed. This banner makes that state UNMISTAKABLE: when
 * the server has auth configured but this device has no live session, it shows a
 * calm, plain-language notice (no jargon) and offers the one recovery action —
 * biometric sign-in (if the device is enrolled) or asking Leo to activate. It
 * never claims success it does not have.
 */
export function RestrictedBanner() {
  const [restricted, setRestricted] = useState(false)
  const [enrolled, setEnrolled] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    const s = await authStatus()
    setRestricted(deriveRestricted(s))
    setEnrolled(s.enrolled)
  }

  useEffect(() => {
    void refresh()
    const onVis = () => { if (!document.hidden) void refresh() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  if (!restricted) return null

  return (
    <div className={styles.banner} dir="rtl" role="status">
      <span className={styles.text}>
        {enrolled
          ? 'המכשיר לא מזוהה כרגע — חלק מהיכולות מוגבלות'
          : 'המכשיר עדיין לא הופעל על ידי לאו — חלק מהיכולות מוגבלות'}
      </span>
      {enrolled && (
        <button
          className={styles.action}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            const r = await passkeyLogin()
            setBusy(false)
            if (r === 'ok') void refresh()
          }}
        >
          כניסה מאובטחת
        </button>
      )}
    </div>
  )
}
