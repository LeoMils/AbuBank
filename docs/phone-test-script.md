# AbuAI Phone Reality Test — 25 Minutes

## Setup
- Device: Galaxy S25 Edge or iPhone
- Mode: Text first (5 min), then Voice (20 min)
- Record the session for review

---

## Part 1: Greeting + Calendar (3 min)

| # | Say | Expected | Risk |
|---|-----|----------|------|
| 1 | שלום | Warm greeting with options | LOW |
| 2 | מה יש לי היום? | Today's events from calendar | LOW |
| 3 | ומחר? | Tomorrow's events (follow-up) | LOW — fixed |
| 4 | ומה אחרי זה? | This week's events (follow-up) | LOW — fixed |

## Part 2: Family (3 min)

| # | Say | Expected | Risk |
|---|-----|----------|------|
| 5 | מי זה נועם? | Family profile of Noam | LOW |
| 6 | ומתי יום ההולדת שלו? | Noam's birthday (pronoun resolved) | LOW |
| 7 | ומור? | Family profile of Mor (follow-up) | LOW — fixed |
| 8 | ספרי לי על הנכדים | List of all grandchildren | LOW — fixed |
| 9 | הילדים של מור | Mor's children listed | LOW — fixed |

## Part 3: Reminder Creation (4 min)

| # | Say | Expected | Risk |
|---|-----|----------|------|
| 10 | תזכירי לי לקחת כדור ב-8 בערב | Reminder confirmation: "לקחת כדור היום ב-20:00. לשמור?" | LOW |
| 11 | כן | Saved confirmation | LOW |
| 12 | תזכירי לי להתקשר לנועם מחר בערב | Reminder: "להתקשר לנועם מחר ב-18:00. לשמור?" | LOW |
| 13 | כן | Saved | LOW |

## Part 4: Appointment Creation + Correction (5 min)

| # | Say | Expected | Risk |
|---|-----|----------|------|
| 14 | תקבעי לי רופא בשלישי בעשר | "רופא ביום שלישי ב-10:00. זה נכון?" | LOW |
| 15 | לא, בעצם ברביעי | Updates to Wednesday, re-asks | LOW |
| 16 | כן | Saved | LOW |
| 17 | מה יש לי ברביעי? | Shows Wednesday events including new appointment | LOW |

## Part 5: Pronoun + Context (4 min)

| # | Say | Expected | Risk |
|---|-----|----------|------|
| 18 | מי זה אופיר? | Ofir's family profile | LOW |
| 19 | תזכירי לי להתקשר אליו מחר | Resolves "אליו"→אופיר, creates reminder | LOW |
| 20 | כן | Saved | LOW |
| 21 | תזכירי לי להתקשר אליה | Asks "למי את מתכוונת?" (no female in context) | LOW — fixed |

## Part 6: Emotional + Casual (3 min)

| # | Say | Expected | Risk |
|---|-----|----------|------|
| 22 | אני קצת משועממת | Warm proactive response with suggestions | LOW |
| 23 | ספרי לי בדיחה | Joke (LLM) | MEDIUM — requires working provider |
| 24 | מתגעגעת לפפי | Warm, gentle emotional response | MEDIUM — requires LLM |

## Part 7: Topic Switch During Draft (3 min)

| # | Say | Expected | Risk |
|---|-----|----------|------|
| 25 | תקבעי לי פגישה בשלישי | Starts appointment, asks for time | LOW |
| 26 | אני רעבה | Cancels draft, responds naturally | LOW — fixed |
| 27 | עזבי | Confirms cancel | LOW |

---

## Key Risks to Watch

1. **Provider availability**: If all providers are down, LLM questions (23, 24) will show warm fallback instead of real answer
2. **Voice transcription**: Whisper may mishear Hebrew words — watch for STT errors
3. **Age question**: "בן כמה הוא?" returns family profile, not computed age (no birth year in data)
4. **Contact history**: "כמה זמן לא דיברתי עם X?" returns family info, not actual call log
5. **Birthday countdown**: "וכמה זמן נשאר ליום ההולדת?" not supported as follow-up

## Pass Criteria

- 20+ of 27 prompts produce expected behavior
- No technical jargon shown to user
- No English error messages
- Pronoun resolution works in at least 3 of 4 cases
- Follow-ups (ומחר?, ומור?, ומה אחרי זה?) all work
- Appointment correction flow completes
- Off-topic during draft cancels cleanly
