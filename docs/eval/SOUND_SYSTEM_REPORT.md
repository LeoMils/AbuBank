# AbuBank — Premium Sound System Report

**Sprint:** Autonomous Sound Design System
**Intended build:** `0.50.0-sound-system` (see "Version collision" below)
**Date:** 2026-07-08
**Scope:** UI sound/feedback infrastructure only. No AbuAI core runtime, cognitive
runtime, AI Task Interpreter, memory, online routing, calendar AI logic, or speech
runtime were modified.

---

## 1. Sound architecture

A single, centralized service — `src/services/sounds.ts` — owns **all** UI sound.
There are no ad-hoc `new Audio()` / oscillator calls scattered in components; every
component imports named sound functions from this one module.

**Synthesis, not assets.** Every sound is generated on the fly with the Web Audio
API (sine oscillators + gain envelopes). No audio files are bundled, no network
requests are made, and the whole system adds ~0 KB of assets.

**One central gate.** Every audible emission passes through a single predicate,
`canPlay()`:

```
canPlay() === true  ⟺  (not muted)  AND  (AbuAI/TTS not currently speaking)
```

This is the only place playback is allowed or suppressed, so there is no
duplicated volume/mute logic anywhere else. `canPlay()` and the mute/voice
predicates are exported specifically so the gate is directly unit-testable.

**Layered gates:**

| Gate | Applies to | Source (read-only) |
|------|-----------|--------------------|
| Mute toggle | all sound + haptics | `localStorage['abu-sound-muted']` (synchronous, in-memory cached) |
| TTS / voice active | all sound | native `window.speechSynthesis.speaking` + optional `window.__abuAISpeaking` hint |
| `prefers-reduced-motion` | haptics (vibration = motion) | `matchMedia('(prefers-reduced-motion: reduce)')` |
| iOS silent switch / media volume | all sound | inherent — Web Audio follows the device media channel |

**Never touches the speech runtime.** The service only *reads* `speechSynthesis.speaking`
(and an optional, app-set `window.__abuAISpeaking` flag) to decide whether it is
safe to emit a sound. It never writes to, drives, or imports the speech/voice code.
This satisfies "do not play sounds while AbuAI is speaking" without coupling to —
or modifying — any protected runtime.

**Fail-silent everywhere.** Under SSR / tests / iOS lockdown / blocked audio,
`window`, `AudioContext`, `localStorage`, `navigator`, and `matchMedia` may all be
absent. Every access is guarded and wrapped so **no path throws** — the worst case
is silence.

**Safe preload / unlock.** Browsers require a user gesture before audio may play.
On import the module binds a one-time `pointerdown` / `keydown` / `touchstart`
listener that warms (resumes) the `AudioContext`, then detaches itself. Guarded so
it is a no-op when there is no DOM.

**Volume.** Deliberately subtle for an 80+ user: peak gains sit at **0.05–0.10**,
tones are **sine** (warm, no harsh harmonics), and durations are **25–250 ms**. The
error sound is a soft downward two-note resolve — never a harsh buzzer.

---

## 2. Sounds added / consolidated

Existing primitives were preserved (same names/signatures, now routed through the
gate) and the library was completed to cover the full scope:

| Function | When | Character |
|----------|------|-----------|
| `soundTap` | button click (existing) | soft 800→600 Hz click + haptic |
| `soundSuccess` | action completed (existing) | C5→E5 warm chime |
| `soundSend` | WhatsApp send (existing) | 400→800 Hz ascending whoosh |
| `soundAlert` | calendar reminder (existing) | C-E-G major arpeggio |
| `soundCopy` | text copied (existing) | quick double pulse |
| `soundProcessing` | AI generating (existing) | soft rhythmic ticks |
| `soundOpen` | modal/sheet opens (existing) | 220→330 Hz soft rise |
| `soundNavigate` | **new** — screen navigation / back | G4→C5 gentle two-step |
| `soundError` | **new** — error toast / failure | G4→Eb4 soft downward resolve |
| `soundSaveCalendar` | **new** — appointment saved | F5→A5 confirming two-note |
| `soundGameTap` | **new** — game tile tap | 660→990 Hz playful blip + haptic |
| `soundRecordStart` | **new** — recording start (UI-level) | 440→660 Hz soft rise |
| `soundRecordStop` | **new** — recording stop (UI-level) | 660→440 Hz soft fall |
| `soundToast` | **new** — notification/toast appears | single quiet A5 |
| `soundComplete` | **new** — gentle completion | soft C5-E5-G5 resolve |

Public control API (new): `getSoundMuted`, `setSoundMuted`, `toggleSoundMuted`,
`subscribeSoundMuted`, `canPlay`, `isVoiceActive`, `unlockAudio`.

### Wiring (call sites)

- **Navigation** → `soundNavigate()` in `components/BackButton` (used app-wide).
- **Toast / notification** → `components/Toast` plays `soundError` / `soundSuccess` /
  `soundToast` matched to the toast variant, on appear.
- **Game tap** → `soundGameTap()` on game-tile open in `AbuGames` (replaced the
  generic open+haptic with the distinct game cue).
- **Calendar save** → `soundSaveCalendar()` on manual create/edit save in
  `AbuCalendar` (the two `handleManualSave` success paths).
- **Existing** tap/success/send/copy/alert/processing/open call sites are unchanged
  in behavior but now respect the mute + TTS gate for free.

`soundRecordStart` / `soundRecordStop` are provided and gated but intentionally
**not** auto-wired into the mic buttons, because those handlers live next to the
protected speech/recording runtime and the sprint forbids touching it. They are
ready for a UI-only hook-up when that surface is worked on deliberately.

---

## 3. Mute / settings behavior

- A new **"צלילים"** toggle was added to the Settings screen (`data-testid="sound-toggle"`),
  directly under the diagnostics button — large (64 px), one-tap, plain-Hebrew label,
  with an immediate visual switch (🔊/🔕 + animated knob) and `aria-pressed`.
- Toggling calls `setSoundMuted()`, which persists to `localStorage['abu-sound-muted']`
  and notifies subscribers synchronously.
- Turning sound **on** plays a confirming tap; turning it **off** stays silent (the
  gate is already closed before any sound would play).
- Default state: **un-muted** (sound enabled). Mute is remembered across sessions.
- Muting also silences haptics (single "quiet mode"); `prefers-reduced-motion`
  independently silences haptics regardless of the toggle.

---

## 4. Files changed

| File | Change |
|------|--------|
| `src/services/sounds.ts` | Rewritten into the centralized, gated service: mute API, TTS/reduced-motion gates, safe preload/unlock, new sounds. All prior exports preserved. |
| `src/services/sounds.test.ts` | **New** — 15 tests covering the gate, mute persistence/subscribe, TTS suppression, reduced-motion haptics, and fail-silent no-op behavior. |
| `src/screens/Settings/index.tsx` | Added the `SoundToggle` component + rendered it. |
| `src/components/Toast/index.tsx` | Variant-matched toast/error/success sound on appear. |
| `src/components/BackButton/index.tsx` | `soundNavigate()` on back navigation. |
| `src/screens/AbuGames/index.tsx` | `soundGameTap()` on game open (swapped the generic open cue). |
| `src/screens/AbuCalendar/index.tsx` | `soundSaveCalendar()` on manual save/edit success. |
| `docs/eval/SOUND_SYSTEM_REPORT.md` | This report. |

Not committed by this sprint: `src/version.ts` and `src/screens/Settings/copyTurnsButton.test.tsx`
— see "Version collision".

---

## 5. Tests / build (evidence)

- `npm run typecheck` — **PASS** (`tsc --noEmit`, clean).
- `npx vitest run src/services/sounds.test.ts` — **PASS**, 15/15.
- `npx vitest run src/screens/AbuGames src/screens/Settings src/components` —
  78/79 pass. The **1 failure** is `copyTurnsButton.test.tsx`'s hard-coded version
  assertion, broken by the concurrent version bump described below — **not** by any
  sound-system change. Every sound-related and touched-component test passes.
- `npm run build` — **PASS** (prebuild validation + Vite build + PWA generation, built in ~8 s).

Evidence level: **HIGH** for the sound gate (deterministic unit tests actually
executed) and for typecheck/build (commands ran to completion). The audible
character of each tone is synthesized deterministically but was **not** verified by
ear on a device — that requires manual/device review.

---

## 6. Remaining risks

1. **Version collision (top risk — needs human coordination).** During this sprint a
   concurrent workstream repeatedly rewrote `src/version.ts` in the working tree to
   `0.50.0-abuwp-data-reliability` (a different feature). Both sprints are claiming
   the same `0.50.0` semver. This sound sprint's intended identity is
   `0.50.0-sound-system`. To avoid clobbering the peer sprint's in-flight file, this
   sprint did **not** commit `version.ts` and left it under the peer's ownership.
   **Action required:** reconcile the two sprints — e.g. bump one to `0.51.0`, or
   merge labels — and update `copyTurnsButton.test.tsx`'s version assertion to
   whichever build actually ships. Until then that one identity test stays red.
2. **Device audio not verified by ear.** Tones are deterministic but their subjective
   pleasantness/volume on a real iPhone/Galaxy has not been confirmed on-device.
3. **iOS first-gesture unlock.** Web Audio needs a real user gesture; the preload
   listener handles the common case, but very first sound after a cold PWA launch may
   be swallowed on some iOS versions. This is inherent to the platform and fails safe (silence).
4. **`soundRecordStart/Stop` not wired.** Provided but intentionally unwired to avoid
   touching the recording/speech runtime; needs a deliberate UI-only hook-up later.
5. **No global "prefers-reduced-sound".** No such media query exists; sound is gated
   by the explicit mute toggle (authoritative) rather than a system audio-reduction
   signal. Reduced-motion is honored for haptics.

---

## 7. Preview URL

Not deployed. No preview deploy was performed this sprint (build verified locally
only). A preview can be produced from the passing `dist/` build on request.
