# iPhone Device UX / Speech / UI — manual acceptance checklist

**Build:** `0.31.0-device-ux`. This sprint touched UI/speech only. Some items are
**code-verified** here (component render + delivery-engine tests); the pixel-level and
physical-voice items are **device-only** — Leo must run them on the iPhone against the
preview. Code-verified ✅ · device-only 📱.

| # | Item | Status | How to check on iPhone |
|---|---|---|---|
| 1 | Long answer scroll | ✅ container `overflowY:auto` + `-webkit-overflow-scrolling:touch` · 📱 feel | Ask a long question; the answer area scrolls smoothly with momentum. |
| 2 | Assistant message clipping | ✅ `white-space:pre-wrap` + `word-break:break-word`, full text present (test) · 📱 | Long reply wraps to lines; nothing cut off at the edge. |
| 3 | Calendar modal readability | 📱 | Open "הוספה ידנית"; fields + labels are large and legible; save button state is obvious. |
| 4 | Event card layout | ✅ title/time/location/notes all render (test) · 📱 | A saved event shows who/when/where/details clearly, no overlap. |
| 5 | Generic "משהו לא עבד" | ✅ reason surfaced + copy-details button + recovery (test) | Force an error; screen stays calm, shows "חזרה הביתה" + "העתקת פרטים לתמיכה"; the reason line is visible. |
| 6 | Copy last 20 turns (visible access) | ✅ "העתקת פרטים לתמיכה" on the error screen copies reason + last 20 turns; console `__abuaiCopyTurns()` always available | On any failure, tap "העתקת פרטים לתמיכה" and paste to Leo; or in Safari console run `__abuaiCopyTurns()`. |
| 7 | Speech continuation | ✅ chunked, full text preserved, resume→exact next chunk (test) · 📱 feel | Long spoken answer; say "תמשיכי" → continues from where it stopped. |
| 8 | Answer chunking | ✅ multiple short chunks, none a long paragraph (test) · 📱 | Speech is delivered in short natural units, not one long block. |
| 9 | "לא שמעתי / תמשיכי / תשלימי" | ✅ "תמשיכי/תשלימי" → next chunk; "לא שמעתי" → calm audio help (keeps context) · 📱 | Say each; "תמשיכי"/"תשלימי" continue; "לא שמעתי" offers to raise volume / retry without losing the thread. |
| 10 | Repeated greetings | ✅ stress gate: no gratuitous "בוקר טוב"/"ערב טוב" on non-greeting turns | Several turns in a row; the assistant greets only when you greet. |
| 11 | Mobile viewport stability | 📱 | Rotate / open keyboard; primary screens don't jump or expose scroll; content respects safe-area. |

## Device-only remainder (cannot be verified without hardware)

- Physical microphone quality + STT accuracy.
- Physical TTS voice feel / interruption timing.
- Pixel-level rendering, safe-area insets, keyboard-overlap on the specific iPhone.
- Smooth-scroll momentum feel.

## Regression guards added this sprint

- `errorBoundary.test.tsx` — reason surfaced + copy-details + recovery.
- `deviceUxLayout.test.tsx` — no assistant-text clip; event card shows every field; readable sizes.
- `speechDelivery.test.ts` — chunking, resume→next chunk, done-not-loop, no markdown/URL in speech.
