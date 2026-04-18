# QA Fix List — AbuBank v15 PR

Sorted by severity. Only real issues that should be fixed before merge.

---

## BLOCKER (1)

### B1: Stale closure sends empty clipboard in AbuWhatsApp voice mode

**File:** `src/screens/AbuWhatsApp/index.tsx`
**Lines:** 292-303 (handleSendToFamily), 358 (call site)
**Problem:** `handleSendToFamily` reads `result` state directly (line 296), but is called from inside `startVoiceListening` which is `useCallback([])`. The closure captures the initial empty `result`. When Martita says "send to family" in voice mode, an empty string is copied to clipboard and WhatsApp opens.
**Fix:** On line 296, change `result` to `resultRef.current`. The ref is already kept in sync on line 132.
```diff
- try { await navigator.clipboard.writeText(result) } catch { /* ignore — message still visible */ }
+ try { await navigator.clipboard.writeText(resultRef.current) } catch { /* ignore — message still visible */ }
```

---

## SHOULD-FIX (6)

### S1: Clipboard failure claims success in AbuWhatsApp handleSendToFamily

**File:** `src/screens/AbuWhatsApp/index.tsx:296`
**Problem:** `catch {}` swallows clipboard error; toast still shows "ההודעה הועתקה!"
**Fix:** In catch block, change toast text to indicate manual copy needed.
```diff
- try { await navigator.clipboard.writeText(result) } catch { /* ignore — message still visible */ }
- setCopyToast(true)
+ let copied = true
+ try { await navigator.clipboard.writeText(resultRef.current) } catch { copied = false }
+ setCopyToast(true)
```
Then update the toast display to show different text based on `copied` state, or simply remove the toast from the catch path.

### S2: Same clipboard pattern in AbuWhatsApp copy button

**File:** `src/screens/AbuWhatsApp/index.tsx:1024`
**Problem:** Same as S1 — `catch {}` with success toast regardless.
**Fix:** Same approach — track whether copy succeeded.

### S3: Calendar modal title says "אירוע חדש" when editing

**File:** `src/screens/AbuCalendar/index.tsx:232`
**Problem:** Hardcoded "אירוע חדש" regardless of `editing` prop.
**Fix:**
```diff
- <span ...>אירוע חדש</span>
+ <span ...>{editing ? 'עריכת אירוע' : 'אירוע חדש'}</span>
```

### S4: Rapid delete overwrites single undo slot

**File:** `src/screens/AbuCalendar/index.tsx:569-595`
**Problem:** Second delete replaces `undoAppt`, losing previous undo. Martita may accidentally delete two events and can only recover one.
**Fix:** Simplest safe fix — disable delete button while undo is active (show undo bar, hide delete buttons). This prevents the second delete entirely until the first undo expires or is dismissed.

### S5: Settings clipboard write has no catch — crashes to Error screen

**File:** `src/screens/Settings/index.tsx:179-183`
**Problem:** `navigator.clipboard.writeText(selectedMsg).then(...)` — no `.catch()`. Unhandled promise rejection triggers global error handler → Error screen.
**Fix:**
```diff
- navigator.clipboard.writeText(selectedMsg).then(() => {
+ navigator.clipboard.writeText(selectedMsg).then(() => {
    setMsgCopied(true)
    setTimeout(() => setMsgCopied(false), 2500)
- })
+ }).catch(() => {})
```

### S6: Too-short recording silently discarded in AbuAI

**File:** `src/screens/AbuAI/index.tsx:215`
**Problem:** `if (blob.size < 1000) return` — no feedback. Martita presses stop and nothing happens.
**Fix:** Show a brief assistant message before returning:
```diff
  if (blob.size < 1000) {
+   setMessages(prev => [...prev, { id: msgCounter++, role: 'assistant', text: 'ההקלטה הייתה קצרה מדי. נסי שוב.' }])
    return
  }
```
