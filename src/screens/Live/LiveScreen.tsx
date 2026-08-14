/*
 * LiveScreen — Abu AI, the live-voice screen, rebuilt in the Night Garden system (M5 STEP 2).
 * ════════════════════════════════════════════════════════════════════════════
 * A deliberately ISOLATED Hebrew live-voice screen. It uses ONLY liveSession.ts —
 * none of the legacy voice cascade (no brain, STT, TTS, fallback, arbiter, registry,
 * leases, flight recorder beyond observation). Mounted as a top-level overlay via
 * window.__abubankOpenLive so it cannot touch any existing screen.
 *
 * The presence: Abu now has a living face (AbuPresence) whose mouth follows her REAL
 * output-audio amplitude. liveSession.onRemoteStream hands us the realtime stream; the
 * AudioContext primed inside the start tap analyses it (useOutputAmplitude → one rAF).
 * onState + onThinking map to the four presence states. Graceful degrade: no analyser
 * ⇒ AbuPresence runs a gentle mouth loop while speaking.
 *
 * iOS: the AudioContext is created + resumed INSIDE the start tap (the only user
 * gesture a home-screen PWA gets), then handed to the session for remote playback AND
 * kept for the mouth analyser. `playsinline` + the muted keep-alive live in liveSession.
 *
 * Theme: PAGE_BG + `t.*` tokens throughout (both Night Garden + Bright Day), ≥56px
 * targets, ≥16px text — the senior-first gate covers the shared tokens/components.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LiveSession,
  startConversation,
  currentConversationId,
  type LiveState,
} from '../../services/liveSession'
import {
  buildWhatsAppCard, buildCallCard, buildCalendarDraftCard, buildCalendarReceiptCard,
  type LiveCard, type Handoff,
} from '../../services/liveActionCards'
import { whatsappAdapter } from '../AbuWhatsApp/whatsappAdapter'
import { phoneAdapter } from '../AbuWhatsApp/phoneAdapter'
import { ActionCard } from './ActionCard'
import { BUILD_ID } from '../../version'
import { PAGE_BG, t } from '../../design/theme'
import { AbuLogo } from '../../design/logos/AbuLogo'
import { FONT_DISPLAY } from '../../design/typography'
import { AbuPresence, type PresenceState } from '../AbuAI/presence/AbuPresence'
import { useOutputAmplitude } from '../AbuAI/presence/useOutputAmplitude'

// Number resolution happens HERE, at the UI layer — the number is encoded straight
// into the wa.me/tel link and never enters the model or the card text (privacy).
const waHandoff: Handoff = (name, text) => whatsappAdapter.buildHandoff(name, text)
const telHandoff: Handoff = (name) => phoneAdapter.buildHandoff(name, '')

/** Map the live session state (+ the transient thinking hint) to a presence state. */
export function toPresenceState(state: LiveState, thinking: boolean): PresenceState {
  if (state === 'connecting') return 'thinking'
  // Her audio starting always wins over a (possibly stale) thinking hint — belt and
  // suspenders alongside the runtime clear of `thinking` on every state transition.
  if (state === 'speaking') return 'speaking'
  if (thinking) return 'thinking'
  if (state === 'listening') return 'listening'
  return 'waiting' // idle / error
}

/** The spelled-out Hebrew word for each RECONCILED presence state. Keyed by
 *  PresenceState (NOT the raw LiveState) so the word Martita reads is the SAME source
 *  of truth as her face and aura — they can never disagree. */
const PRESENCE_LABEL: Record<PresenceState, string> = {
  listening: 'מקשיבה',
  thinking: 'חושבת',
  speaking: 'מדברת',
  waiting: 'מוכנה',
}

/**
 * The ONE state word shown to Martita, large and unambiguous. It is driven by the
 * RECONCILED presence state — never by the raw session state — so it can never claim
 * "מקשיבה" (listening) while Abu is actually speaking or thinking (the trace defect:
 * "you are speaking while the screen says you are listening"). During an active turn it
 * is therefore always exactly one of מקשיבה / חושבת / מדברת. `connecting` is the one
 * honest pre-conversation transient ("מתחברת…") before any turn has begun.
 */
export function liveStateWord(state: LiveState, presence: PresenceState): string {
  if (state === 'connecting') return 'מתחברת…'
  return PRESENCE_LABEL[presence]
}

export function LiveScreen({ onClose }: { onClose: () => void }) {
  const sessionRef = useRef<LiveSession | null>(null)
  const [state, setState] = useState<LiveState>('idle')
  const [started, setStarted] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [abuText, setAbuText] = useState('')
  const [card, setCard] = useState<LiveCard | null>(null)
  // Presence wiring: the primed context + the remote stream feed the mouth analyser;
  // `thinking` is the user-just-finished hint (cleared on the next state transition).
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null)
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [thinking, setThinking] = useState(false)

  const amplitude = useOutputAmplitude(audioCtx, remoteStream)
  const presenceState = toPresenceState(state, thinking)

  const teardown = useCallback(() => {
    sessionRef.current?.teardown()
    sessionRef.current = null
    setRemoteStream(null)
    setThinking(false)
  }, [])

  // Start (or retry) a session. MUST run inside a user gesture so the AudioContext
  // unlock and getUserMedia prompt are permitted on iOS.
  const begin = useCallback(async (isReconnect: boolean) => {
    teardown()
    setErrorMsg(null)
    setStarted(true)

    // Unlock audio inside the gesture: create + resume the context now, and hand
    // the SAME primed context to the session for the remote playback graph AND to
    // the mouth analyser (useOutputAmplitude).
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
    setAudioCtx(primed)

    const conversationId = isReconnect
      ? (currentConversationId(window.localStorage) ?? startConversation(window.localStorage))
      : startConversation(window.localStorage)

    const session = new LiveSession(
      {
        onState: (s) => { setState(s); setThinking(false) },
        onAbuTranscript: (t2) => setAbuText(t2),
        onError: (messageHe) => { setErrorMsg(messageHe) },
        // Presence: the realtime stream drives the mouth; the thinking hint bridges
        // the gap between the user finishing and Abu's first audio.
        onRemoteStream: (stream) => setRemoteStream(stream),
        onThinking: () => setThinking(true),
        // Action-card receipts (Part B) — the card is the proof, never speech alone.
        onCommDraft: (d) => {
          if (!d || d.status === 'CANCELLED') { setCard(null); return }
          setCard(d.kind === 'call' ? buildCallCard(d, telHandoff) : buildWhatsAppCard(d, waHandoff))
        },
        onCalendarDraft: (d) => {
          const c = buildCalendarDraftCard(d)
          setCard((prev) => (c ? c : prev && prev.kind === 'calendar-receipt' ? prev : null))
        },
        onCalendarSaved: (e) => setCard(buildCalendarReceiptCard(e)),
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

  const handleEnd = () => { setCard(null); teardown(); onClose() }

  // The calendar draft card's Confirm button sends a typed "yes" into the session so
  // the model saves it (and then fires the receipt card). Never saves client-side.
  const confirmCalendar = useCallback(() => {
    sessionRef.current?.sendUserText('כן, זה מושלם, תשמרי את זה')
  }, [])

  const isError = state === 'error' || !!errorMsg

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed', inset: 0, zIndex: 9000, background: PAGE_BG, color: t.textStrong,
        display: 'flex', flexDirection: 'column', alignItems: 'stretch',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* ── Header: close + the Abu AI mark (Night Garden family) ───────────────── */}
      <header style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '18px 18px 6px' }}>
        <button
          onClick={handleEnd}
          aria-label="סגירה"
          style={{
            width: 56, height: 56, borderRadius: '50%', border: `1px solid ${t.border}`,
            background: t.surface, color: t.textStrong, fontSize: 24, cursor: 'pointer', flexShrink: 0,
          }}
        >
          ✕
        </button>
        <AbuLogo app="ai" size={40} style={{ flexShrink: 0 }} />
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: t.textStrong, display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ color: t.gold, fontFamily: FONT_DISPLAY, fontStyle: 'italic', fontSize: 27 }}>Abu</span>
          <span>AI</span>
        </h1>
      </header>

      {/* ── Centre: the living presence + a plain-Hebrew state label + transcript ── */}
      <main
        style={{
          flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 18, padding: '4px 24px', textAlign: 'center',
        }}
      >
        <AbuPresence state={presenceState} amplitude={amplitude} size={230} />

        {/* The ONE state indicator — colour-coded via the aura AND spelled out here (never
            colour-only), large for an 80-year-old, and driven by the SAME reconciled presence
            state as her face so the word can never disagree with what she is actually doing. */}
        <div
          data-testid="live-state-word"
          aria-live="polite"
          style={{ fontSize: 30, fontWeight: 800, color: isError ? '#F5A9A0' : t.gold, letterSpacing: 0.3 }}
        >
          {isError ? 'שגיאה' : liveStateWord(state, presenceState)}
        </div>

        {abuText && !isError && (
          <div style={{ fontSize: 19, lineHeight: 1.55, maxWidth: 520, color: t.textMedium }}>{abuText}</div>
        )}

        {isError && (
          <div style={{ fontSize: 19, lineHeight: 1.55, maxWidth: 520, color: '#F5A9A0' }}>
            {errorMsg ?? 'משהו השתבש.'}
          </div>
        )}
      </main>

      {/* ── Footer: primary action + operator affordances ──────────────────────── */}
      <footer style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '6px 24px 22px' }}>
        {!started && (
          <button
            onClick={() => void begin(false)}
            style={{
              minWidth: 240, minHeight: 68, borderRadius: 34, border: 'none',
              background: t.gold, color: '#1a1200', fontSize: 24, fontWeight: 800, cursor: 'pointer',
            }}
          >
            התחילי שיחה
          </button>
        )}

        {isError && (
          <button
            onClick={() => void begin(true)}
            style={{
              minWidth: 200, minHeight: 60, borderRadius: 30, border: `1px solid ${t.gold}`,
              background: 'transparent', color: t.gold, fontSize: 22, fontWeight: 700, cursor: 'pointer',
            }}
          >
            נסי שוב
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 520, minHeight: 34 }}>
          {/* Flight-recorder export — subtle, operator-facing. Downloads the whole-session trace. */}
          {started ? (
            <button
              onClick={() => sessionRef.current?.exportTrace()}
              aria-label="שמירת תיעוד השיחה"
              style={{
                minHeight: 34, padding: '6px 12px', borderRadius: 10, border: `1px solid ${t.border}`,
                background: t.surface, color: t.textMuted, fontSize: 13, cursor: 'pointer',
              }}
            >
              תיעוד ⤓
            </button>
          ) : <span />}

          {/* Build fingerprint — small corner text so any screenshot proves which build
              actually ran on the device. Never a secret; build identity only. */}
          <div
            data-testid="live-build-id"
            style={{
              fontSize: 11, fontFamily: 'ui-monospace, monospace', color: t.textMuted,
              letterSpacing: 0.2, pointerEvents: 'none', userSelect: 'text',
            }}
          >
            {BUILD_ID}
          </div>
        </div>
      </footer>

      {/* Action-card receipt — the visible proof of a prepared action (Part B). */}
      {card && (
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 9100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: t.scrim, padding: 20,
          }}
        >
          <ActionCard card={card} onDismiss={() => setCard(null)} onConfirm={confirmCalendar} />
        </div>
      )}
    </div>
  )
}
