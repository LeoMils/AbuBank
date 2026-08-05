/*
 * LiveScreen — Abu AI, Milestone 1 UI.
 * ════════════════════════════════════
 * A deliberately minimal, ISOLATED Hebrew live-voice screen. It uses ONLY
 * liveSession.ts — none of the legacy voice cascade (no brain, STT, TTS,
 * fallback, arbiter, registry, leases, flight recorder). Mounted as a top-level
 * overlay via `?live=1` so it cannot touch any existing screen (mirrors the
 * FamilyPhones isolation pattern in App.tsx).
 *
 * iOS: the AudioContext is created + resumed INSIDE the start tap (the only user
 * gesture a home-screen PWA gets), then handed to the session so remote playback
 * is unlocked. `playsinline` and the muted keep-alive element live in liveSession.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LiveSession,
  startConversation,
  currentConversationId,
  type LiveState,
} from '../../services/liveSession'

const BG = '#050A18'
const GOLD = '#C9A84C'
const TEXT = '#F5F3EC'

const STATE_LABEL: Record<LiveState, string> = {
  idle: 'מוכנה',
  connecting: 'מתחברת…',
  listening: 'מקשיבה',
  speaking: 'מדברת',
  error: 'שגיאה',
}

export function LiveScreen({ onClose }: { onClose: () => void }) {
  const sessionRef = useRef<LiveSession | null>(null)
  const [state, setState] = useState<LiveState>('idle')
  const [started, setStarted] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [abuText, setAbuText] = useState('')

  const teardown = useCallback(() => {
    sessionRef.current?.teardown()
    sessionRef.current = null
  }, [])

  // Start (or retry) a session. MUST run inside a user gesture so the AudioContext
  // unlock and getUserMedia prompt are permitted on iOS.
  const begin = useCallback(async (isReconnect: boolean) => {
    teardown()
    setErrorMsg(null)
    setStarted(true)

    // Unlock audio inside the gesture: create + resume the context now, and hand
    // the SAME primed context to the session for the remote playback graph.
    let primed: AudioContext | null = null
    try {
      const Ctor = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      const C = Ctor.AudioContext ?? Ctor.webkitAudioContext
      if (C) {
        primed = new C()
        await primed.resume().catch(() => { /* */ })
        // A one-sample silent blip fully unlocks iOS output routing.
        try {
          const buf = primed.createBuffer(1, 1, 22050)
          const src = primed.createBufferSource()
          src.buffer = buf
          src.connect(primed.destination)
          src.start(0)
        } catch { /* */ }
      }
    } catch { /* WebAudio unavailable — session degrades to the keep-alive element */ }

    const conversationId = isReconnect
      ? (currentConversationId(window.localStorage) ?? startConversation(window.localStorage))
      : startConversation(window.localStorage)

    const session = new LiveSession(
      {
        onState: setState,
        onAbuTranscript: (t) => setAbuText(t),
        onError: (messageHe) => { setErrorMsg(messageHe) },
      },
      conversationId,
      isReconnect,
      primed ? { createAudioContext: () => primed } : undefined,
    )
    sessionRef.current = session
    void session.connect()
  }, [teardown])

  // Tear the session down when the screen unmounts.
  useEffect(() => () => { teardown() }, [teardown])

  // Resume the audio context when the tab returns to the foreground (iOS may
  // suspend it on backgrounding). Fail closed: if the connection died while
  // hidden, the session already surfaced an error + retry.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && sessionRef.current) {
        // Nothing to resume directly here; the session holds the context. This
        // listener exists so backgrounding is an explicit, handled event.
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const handleEnd = () => { teardown(); onClose() }

  const isError = state === 'error' || !!errorMsg
  const orbColor = state === 'speaking' ? GOLD : state === 'listening' ? '#4ADE80' : isError ? '#F87171' : 'rgba(201,168,76,0.4)'

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed', inset: 0, zIndex: 9000, background: BG, color: TEXT,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 28, padding: 24, textAlign: 'center', fontFamily: 'system-ui, sans-serif',
      }}
    >
      <button
        onClick={handleEnd}
        aria-label="סגירה"
        style={{
          position: 'absolute', top: 20, insetInlineStart: 20, width: 56, height: 56,
          borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
          background: 'rgba(255,255,255,0.06)', color: TEXT, fontSize: 24, cursor: 'pointer',
        }}
      >
        ✕
      </button>

      <div style={{ fontSize: 34, fontWeight: 700, color: GOLD, letterSpacing: 0.5 }}>Abu</div>

      {/* Live orb — colour-coded AND labelled (no colour-only state). */}
      <div
        style={{
          width: 168, height: 168, borderRadius: '50%',
          background: `radial-gradient(circle at 50% 45%, ${orbColor}, rgba(5,10,24,0.9))`,
          boxShadow: `0 0 60px ${orbColor}`,
          transition: 'background 0.4s, box-shadow 0.4s',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 22, fontWeight: 600 }}>{STATE_LABEL[state]}</span>
      </div>

      {abuText && !isError && (
        <div style={{ fontSize: 20, lineHeight: 1.5, maxWidth: 520, opacity: 0.9 }}>{abuText}</div>
      )}

      {isError && (
        <div style={{ fontSize: 20, lineHeight: 1.5, maxWidth: 520, color: '#FCA5A5' }}>
          {errorMsg ?? 'משהו השתבש.'}
        </div>
      )}

      {!started && (
        <button
          onClick={() => void begin(false)}
          style={{
            marginTop: 8, minWidth: 240, minHeight: 68, borderRadius: 34,
            border: 'none', background: GOLD, color: '#1a1200', fontSize: 24, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          התחילי שיחה
        </button>
      )}

      {isError && (
        <button
          onClick={() => void begin(true)}
          style={{
            marginTop: 8, minWidth: 200, minHeight: 60, borderRadius: 30,
            border: `1px solid ${GOLD}`, background: 'transparent', color: GOLD, fontSize: 22, fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          נסי שוב
        </button>
      )}
    </div>
  )
}
