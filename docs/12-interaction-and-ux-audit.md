# 12 — Interaction & UX Audit

> Every interaction flow, feedback loop, failure mode, and accessibility concern. Evidence-only.

## Voice Mode State Machines

### AbuAI Voice Conversation
```
[idle] → enterVoiceMode() → [greeting]
  ├─ speak greeting
  ├─ (first today?) fetch date fact → speak → [listening]
  └─ (else) 250ms delay → [listening]

[listening]
  ├─ WSR primary: onresult → collect transcript
  │   ├─ 2.2s silence after speech → commit → [processing]
  │   ├─ 15s no speech events → restart [listening]
  │   └─ onerror: 'not-allowed' → [exit] / else → restart [listening]
  └─ MediaRecorder fallback: silence detector → stop → Whisper → [processing]

[processing]
  ├─ check exit keywords → [exit]
  ├─ sendMessage(text, voiceMode=true)
  └─ response received → [speaking]

[speaking]
  ├─ speakVoiceMode(response)
  ├─ 150ms pause
  └─ if still voiceMode → [listening]

[exit]
  ├─ cleanupVoiceResources()
  ├─ stopSpeaking()
  └─ → [idle]
```

### AbuWhatsApp Voice Commands
```
[idle] → enterVoiceMode() → speak("מה תרצי לכתוב למשפחה?") → [listening]

[listening]
  ├─ WSR primary: onresult → detectVoiceCommand(text)
  └─ MediaRecorder fallback: 10s countdown → Whisper → detectVoiceCommand(text)

detectVoiceCommand() →
  ├─ 'exit' → exitVoiceMode() → [idle]
  ├─ 'send' (has result) → speak("שולחת למשפחה") → handleSendToFamily() → [listening]
  ├─ 'retry' (has lastIntent) → voiceGenerate(lastIntent) → speak result → [listening]
  ├─ 'style' change → voiceGenerate(intent, newStyle) → speak result → [listening]
  └─ new intent → voiceGenerate(text) → speak result → [listening]
```

### AbuCalendar Voice Input (One-Shot)
```
[idle] → tap mic → getUserMedia → [recording]
[recording] → tap mic → stop → [transcribing]
[transcribing] → Whisper API → [parsing]
[parsing] → Groq LLM → [confirming]
[confirming] → "כן, שמרי!" → addAppointment → [idle]
            → "ביטול" → discard → [idle]
```

## Feedback Loops — Complete Inventory

### Home Screen
| Action | Feedback | Timing | Quality |
|--------|----------|--------|---------|
| Tap service bubble | Scale 0.92, shadow reduce | Instant | Good |
| Tap Martita photo | Scale 0.93 | Instant | Good |
| Tap location | GPS request → toast if no contacts | 0-6s | Incomplete — no denial feedback |
| Triple-tap Martita | Navigate to Admin | Instant | Hidden gesture (intentional) |
| Grid entrance | Staggered fade+scale | 60ms + 40ms/tile | Polished |

### AbuAI
| Action | Feedback | Timing | Quality |
|--------|----------|--------|---------|
| Send text | Message appears → loading dots → response | Immediate → 2-15s | Good |
| Tap mic (manual) | Button red, timer counts | Instant | Excellent |
| Stop recording | Spinner in mic → transcript fills input | 1-5s | Good, but silent on failure |
| Enter voice mode | Greeting speaks, phase ring appears | 250ms | Good |
| Voice listens | Gold ring + mic icon + "מקשיבה..." dots | Instant | Clear |
| Voice processing | Spinner in ring + "חושב..." | Instant | Clear |
| Voice speaking | 7 wave bars + "מדבר..." | Instant | Very clear |
| Exit voice mode | Overlay fades, input bar returns | Instant | Good |
| API error (chat) | Error message in chat bubble | Immediate | Acceptable |
| API error (voice) | Speaks error text, returns to listening | 2-3s | Good recovery |
| Transcription fail | SILENT — input unchanged | — | BAD |
| Mic denied | SILENT — nothing happens | — | BAD |
| getUserMedia fail in voice | SILENT exit from voice mode | — | BAD |
| TTS failure | SILENT — continues without audio | — | BAD |

### AbuWhatsApp
| Action | Feedback | Timing | Quality |
|--------|----------|--------|---------|
| Select style pill | Pill highlights, direct generate for non-original | Instant | Good |
| Type + generate | Loading dots → result card | 2-10s | Good |
| Tap mic (manual) | Red pulse, timer | Instant | Excellent |
| Stop recording | Transcribing dots → generating | 1-5s | Good |
| Copy result | Green toast "ההודעה הועתקה!" | 5s auto-dismiss | Excellent |
| Send to WhatsApp | Toast → WhatsApp opens | 500ms delay | Good |
| Retry | New generation, same style | 2-10s | Good |
| Listen (TTS) | Button state changes, audio plays | 1-3s | Good |
| Enter voice mode | Speaks "מה תרצי לכתוב למשפחה?" | 200ms | Good |
| Voice listening | Teal ripple orb + "מקשיבה" | Instant | Excellent |
| Voice processing | Pulsing dots + "מכינה הודעה" | Instant | Clear |
| Voice speaking | Green icon + "מקריאה" | Instant | Clear |
| Error (text) | Red banner above content | Immediate | Prominent |
| voiceGenerate returns null | Speaks error from error state | — | Convoluted path |
| TTS failure in voice | SILENT | — | BAD |
| getUserMedia fail in voice | SILENT exit | — | BAD |

### AbuCalendar
| Action | Feedback | Timing | Quality |
|--------|----------|--------|---------|
| Tap day cell | Selected highlight, appointments list updates | Instant | Good |
| Navigate month | Month/year label changes, grid rebuilds | Instant | Good |
| Tap voice mic | Button turns red, "מקשיבה..." label | Instant | Good |
| Stop voice | "מעבדת..." → "מנתחת..." → confirmation card | 2-8s | Good |
| Confirm voice event | Toast "האירוע נשמר" | Instant | Good |
| Add manual event | Modal opens with animation | 0.28s | Good |
| Save manual event | Toast "האירוע נשמר", modal closes | Instant | Good |
| Delete event | PERMANENT — no undo, no confirmation | Instant | DANGEROUS |
| Alert fires | Banner slides in + sound | 60s check interval | Good |
| Empty day selected | Italic "אין אירועים היום" | Instant | Adequate |
| Voice transcription fail | "שגיאה בזיהוי קול" toast (3s) | 3s | Acceptable |

## Silent Failure Inventory

| # | Screen | Failure | What Happens | What Should Happen |
|---|--------|---------|-------------|-------------------|
| 1 | Home | Geolocation denied | Sends maps.google.com (no coords) | Show error toast "לא הצלחתי לקבל מיקום" |
| 2 | Home | WhatsApp not installed | Silent redirect failure | Show fallback or error |
| 3 | AbuAI | Manual transcription fails | Input stays empty | Show error toast |
| 4 | AbuAI | Mic permission denied (manual) | Nothing happens | Show permission request or error |
| 5 | AbuAI | getUserMedia fails in voice mode | Voice mode exits silently | Speak error before exit |
| 6 | AbuAI | TTS fails during voice mode | Continues without audio | Speak via fallback or show text |
| 7 | AbuAI | Date fact API fails | Greeting silently simplified | Acceptable (graceful) |
| 8 | AbuWhatsApp | voiceGenerate returns null | Speaks error from state variable | Works but convoluted code path |
| 9 | AbuWhatsApp | TTS fails in voice mode | SILENT | Speak via fallback or show text |
| 10 | AbuWhatsApp | getUserMedia fails in voice | SILENT exit | Speak error before exit |
| 11 | AbuCalendar | No Groq API key | Falls back to raw text as title | Acceptable (graceful) |
| 12 | AbuCalendar | localStorage quota exceeded | Save fails silently | Show error toast |
| 13 | Settings | Geolocation denied | Falls back to maps.google.com | Show error message |
| 14 | voice.ts | All 6 TTS providers fail | Returns false, no audio | Caller must handle (most don't) |

## Resource Leak Inventory

| # | Screen | Resource | Issue | Severity |
|---|--------|----------|-------|----------|
| 1 | AbuAI | `recognitionRef` (WSR) | NOT aborted in useEffect cleanup on unmount | MEDIUM |
| 2 | AbuWhatsApp | `recognitionRef` (WSR) | NOT aborted in useEffect cleanup on unmount | MEDIUM |
| 3 | AbuAI | setTimeout chains in startVoiceListening | Speech timeout refs properly cleared in most paths | LOW |
| 4 | AbuWhatsApp | setTimeout calls (lines 406, 415, 421) | Restart delays not tracked in refs | LOW |
| 5 | Home | Module-level navigation timer | Cleared by cancelNavigation() | LOW |
| 6 | voice.ts | `_sharedAudioCtx` | Persisted intentionally (iOS workaround) | NONE (by design) |
| 7 | AbuAI | Messages array | Grows indefinitely, no trim | LOW-MEDIUM |

## Accessibility Audit for 80+ User

### Critical Font Size Issues
| Screen | Element | Size | Issue |
|--------|---------|------|-------|
| Home | Settings gear label | 12px | Too small |
| Home | Service label | 15px | Borderline |
| Home | Footer label | 14px | Small |
| AbuAI | Sender label ("את", "אבו AI") | 12px | Too small, low opacity (0.42/0.55) |
| AbuAI | Timestamp | 12px | Too small, very low opacity (0.30) |
| AbuAI | "ABU AI" sub-label | 10px | Way too small |
| AbuCalendar | Day headers | 12px | Small for 80+ |
| AbuCalendar | Day numbers | 15px | Should be 18px+ |
| AbuCalendar | Input labels | 12px | Small |
| Settings | Contact relation | 12px | Small |
| Settings | Section description | 12px | Small |

### Touch Target Violations (below 44px)
| Screen | Element | Actual | Required |
|--------|---------|--------|----------|
| Settings | Back button | 40×40 | 44×44 |
| Settings | Contact action buttons | 36×36 | 44×44 |
| FamilyGallery | Info button | 28×28 | 44×44 |

### Contrast Concerns
| Screen | Element | Issue |
|--------|---------|-------|
| Home | Gradient text on dark bg | Hard to read for low vision |
| AbuAI | Sender labels at 0.42-0.55 opacity | Very low contrast |
| AbuAI | Timestamps at 0.30 opacity | Nearly invisible |
| AbuCalendar | Empty state at 0.35 opacity | Very faded |
| AbuCalendar | Day headers at 0.50 opacity | Borderline |

### Missing Cognitive Aids
- No undo for calendar delete
- No confirmation before WhatsApp redirect
- No confirmation before external service navigation
- No error feedback when geolocation denied
- No visual indicator that back button exists (inconsistent designs)
- Voice mode exit requires knowing exit keywords or finding exit button

### Positive Accessibility Features
- Large Martita portrait (74px) — clear focal point
- Voice-first input options on Calendar, AI, WhatsApp
- Hebrew UI throughout
- Large voice mode buttons (72-108px)
- Sound feedback on key actions
- Alert banner with sound for calendar reminders

## Navigation Clarity

### Can Martita always get home?
- From AbuAI: YES (back button top-right, exits voice mode first)
- From AbuWhatsApp: YES (back button top-right, exits voice mode first)
- From AbuCalendar: YES (back button in header)
- From AbuWeather: YES (back button in header)
- From AbuGames: YES (back button in header)
- From FamilyGallery: YES (back button in header)
- From Settings: YES (back button in header)
- From Admin: YES (BackToHome component)
- From Opening: NO explicit back — waits for iframe load

### Is the back button recognizable?
**NO** — 8 different designs. Some use house icon, some use arrow, some use chevron, some have text, some don't. An 80+ user cannot build muscle memory.

### Can Martita always understand where she is?
- Home: YES — clear brand header + service grid
- AbuAI: YES — "Martit AI" wordmark
- AbuWhatsApp: YES — "Abu הודעות" wordmark
- AbuCalendar: YES — "Abu יומן" wordmark + calendar grid
- AbuWeather: YES — weather emoji + temperature
- AbuGames: YES — "Abu Games" wordmark + game cards
- Other screens: MOSTLY — headers identify each screen

## Microphone Dominance Assessment

Voice input is available on 3 of 5 main screens:
- AbuAI: Full conversation mode + manual recording
- AbuWhatsApp: Full command mode + manual recording
- AbuCalendar: One-shot recording for event creation

### Voice Button Prominence
| Screen | Button Size | Position | Visual Weight |
|--------|------------|----------|---------------|
| AbuAI (empty) | 56×56 | Center of empty state | Medium |
| AbuAI (chat) | 56×56 | Input bar left | Medium |
| AbuWhatsApp | 108×108 | Center, below intent | HIGH — dominant |
| AbuCalendar | 80×80 | Center, above manual button | HIGH — hero element |

### Assessment
- Calendar voice button is the hero element — good for voice-first UX
- WhatsApp voice CTA (108px) is the largest interactive element on any screen
- AbuAI voice mode is hidden in a small pill/button — less discoverable
- Manual recording (mic in input bar) is consistent between AbuAI and AbuWhatsApp

## Alert Visibility

### Calendar Alerts
- Position: Fixed, top: 72px (below header)
- Appearance: Gold text on dark background, slides down
- Sound: `soundAlert()` plays
- Duration: Stays until dismissed
- Check interval: Every 60 seconds

### Potential Issues
- Alert checks every 60s — could miss a narrow window if user opens app exactly at event time
- Alert banner overlaps scrollable content — may be obscured if user scrolls
- No persistent notification (no push notifications, no badge)
- `alertedIdsRef` never cleared — if Martita dismisses and re-opens, won't re-alert

### Other Screens: No Alert System
- AbuAI: No alerts
- AbuWhatsApp: No alerts (copy toast is informational, not alerting)
- AbuWeather: No alerts for severe weather
- Home: No pending event indicator
