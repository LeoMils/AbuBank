# Storage / Persistence Map

## localStorage Keys

| Key | Used By | Purpose | Lost on Preview URL Change | Lost on Browser Reset | Production Safe | Backup Path |
|-----|---------|---------|---------------------------|----------------------|-----------------|-------------|
| `abubank-calendar-appointments` | AbuCalendar service | Calendar events array | YES | YES | P1 — data loss risk | Export JSON from calendar UI |
| `abubank.familyContacts.v1` | AbuWhatsApp storage | Family phone numbers & photos | YES | YES | P1 — needs re-import | Import JSON via operator UI |
| `abu_reminders_v1` | reminderStore | Reminders array | YES | YES | P2 | No export path yet |
| `abu-voice-lang` | Settings | Voice language preference | YES | YES | Low impact | Re-select in settings |
| `abu-voice-speed` | Settings / voice.ts | Voice speed (0-2) | YES | YES | Low impact | Re-select in settings |
| `abu-voice-debug` | VoiceCard | Voice debug mode toggle | YES | YES | Dev only | N/A |
| `abubank-tools-disabled` | AbuAI service | Tools feature flag | YES | YES | Dev only | N/A |
| `abu-openai-tts-quota-failed` | voice.ts | TTS quota fail timestamp | YES | YES | Ephemeral | Self-clears after 5min |
| `abu-openai-quota-failed` | AbuAI index | Chat quota fail timestamp | YES | YES | Ephemeral | Self-clears after 5min |
| `abubank-alert-minutes` | AbuCalendar | Alert timing pref | YES | YES | Low impact | Re-select |
| `abubank-alerted-ids` | AbuCalendar | Already-alerted appointment IDs | YES | YES | Ephemeral | N/A |
| `abu-dismiss-v1` | App / InstallGuidance | Install guidance dismissal | YES | YES | Low impact | Re-dismiss |
| `abuai-voice-date` | AbuAI | Last voice interaction date | YES | YES | Ephemeral | N/A |
| `abu-noise-mode` | AbuAI | Noise suppression mode | YES | YES | Low impact | Re-select |

## IndexedDB

| Database | Version | Store | Purpose | Lost on Preview URL Change | Lost on Browser Reset |
|----------|---------|-------|---------|---------------------------|----------------------|
| `abu-bank-db` | 1 | `services` | Service configurations (keyPath: id) | YES | YES |
| `abu-bank-db` | 1 | `meta` | Metadata store (keyPath: key) | YES | YES |

## File-Based (Non-volatile)

| Source | Purpose | Editable |
|--------|---------|----------|
| `knowledge/family_data.json` | Family relationships SOT | Via source |
| `knowledge/martita_personality.yaml` | Personality SOT | Via source |
| `memory/*.yaml` | Auto-generated family/birthday data | Via `npm run generate:memory` |
| `public/family-contacts/*.jpeg` | Contact avatar photos | Via source |

## Critical Risks

1. **Calendar events** — localStorage only. Lost on preview URL change, browser reset, or device switch. No server-side backup.
2. **Family contacts** — localStorage only. Phone numbers must be re-imported via operator UI JSON on each new preview URL.
3. **Reminders** — localStorage only. No export path exists.

## Mitigation

- Calendar and contacts have import/export JSON capability
- For production: Leo should bookmark the stable preview URL and avoid clearing browser data
- Future: consider server-side storage for calendar events (requires auth design)
