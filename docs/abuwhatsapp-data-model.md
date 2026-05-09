# AbuWhatsApp — Data Model

This document describes how AbuWhatsApp stores and surfaces family-contact data
in AbuBank. The product goal is a senior-friendly launcher that lets Martita
reach her family in one tap. The repository is public on GitHub and the build
is published to a public Vercel preview, so the model is split into two layers:
**public committed data** (no secrets) and **private device-only data** (real
phone numbers).

## Layered architecture

```
┌──────────────────────────────────────────────┐
│ Public scaffold — committed in source        │
│   src/screens/AbuWhatsApp/                   │
│     familyContacts.private.ts                │
│   • ids, displayName, relationshipHebrew     │
│   • photoFile (path under /public)           │
│   • visual order = array order               │
│   • phoneE164 always ''  (empty string)      │
│   • enabled    always false                  │
└──────────────────────────────────────────────┘
                     │ merged at runtime via
                     │ mergeFacesWithLocal()
                     ▼
┌──────────────────────────────────────────────┐
│ Private overrides — localStorage only        │
│   key: abubank.familyContacts.v1             │
│   • phoneE164      (E.164, e.g. +972…)       │
│   • whatsappE164?  (optional alt number)     │
│   • enabled        (operator toggle)         │
│   • photoDataUrl?  (operator-pasted image)   │
└──────────────────────────────────────────────┘
                     │ produces
                     ▼
            FamilyQuickFaces grid
            (Martita-facing UI)
```

## Public committed fields

| Field                | Type                          | Notes                                                       |
| -------------------- | ----------------------------- | ----------------------------------------------------------- |
| `id`                 | stable lowercase string       | grid key + override key                                     |
| `displayName`        | Hebrew                        | renders under the bubble                                    |
| `relationshipHebrew` | Hebrew, optional              | rendered only in operator setup, not in Martita's view      |
| `photoFile`          | path under `/public`          | resolved by the browser at runtime                          |
| visual order         | array order in `FAMILY_QUICK_FACES` | family group first, then persons row-major across the grid  |

The scaffold contains **no real phone numbers**. Every person row commits
`phoneE164: ''` and `enabled: false`. The TypeScript type still includes these
fields so the UI never has to special-case "missing".

## Private local-only fields

These fields live ONLY in `localStorage`, scoped to a single device, under the
versioned key `abubank.familyContacts.v1`. They never enter the bundle, never
leave the device, never reach an LLM, and never enter `memory/*`,
`knowledge/*`, or `.ai-runs/*`.

| Field          | Type     | Required           | Notes                                              |
| -------------- | -------- | ------------------ | -------------------------------------------------- |
| `id`           | string   | yes                | matches a scaffold id                              |
| `enabled`      | boolean  | yes                | gates whether action chips render                   |
| `phoneE164`    | string   | yes when `enabled` | full E.164 (e.g. `+972XXXXXXXXX`)                  |
| `whatsappE164` | string   | optional           | alternate WhatsApp number if it differs from voice |
| `photoFile`    | string   | optional           | overrides scaffold photoFile                       |
| `photoDataUrl` | string   | optional           | base64 data URL for an operator-pasted image       |

The shape is enforced by `isLocalFamilyContactShape` in
`familyContactsStorage.ts`; the operator setup screen and the JSON import path
both use it.

## Why phone numbers are not committed

- The repository is public on GitHub.
- The build is published to a public Vercel preview URL.
- A leaked phone number is forever — it cannot be redacted from Git history,
  CDNs, scrapers, or LLM training data.
- Phone numbers belong to their owners, not to the codebase.

The only safe place for a phone number is the device that will dial it.

## How localStorage stores them

- Key: `abubank.familyContacts.v1`
- Value: `JSON.stringify(LocalFamilyContact[])`
- Reads: `getLocalContacts()`
- Writes: `upsertLocalContact()`, `setLocalContacts()`, `removeLocalContact()`,
  `clearLocalContacts()`
- Shape validation: `isLocalFamilyContactShape()`

If `localStorage` is unavailable (private mode, blocked) the helpers degrade to
empty/no-op silently. The grid still renders every scaffold person; tapping
shows the missing-phone toast.

## Operator import / export

The operator opens `FamilyContactsSetup.tsx` either by appending `?operator=1`
to the URL or by long-pressing the AbuWhatsApp screen title for ~1.5s. Per-row
controls always show. Under the collapsed `<details>` labelled **מתקדם**, the
operator gets:

- **ייבוא JSON** — paste a JSON array of `LocalFamilyContact` objects; the
  parser validates shape and E.164 before writing to `localStorage`.
- **ייצוא JSON** — serialize the current `localStorage` value into the textarea
  for copy/paste backup.
- **נקי הכל** — clear every contact from `localStorage` (two-step confirm).

JSON UI exists ONLY here. The Martita-facing grid (`familyQuickFaces.tsx`)
contains no `<textarea>` and no JSON copy.

### Moving data to a new phone

1. On the old device, open AbuWhatsApp setup → **מתקדם** → **ייצוא JSON**.
2. Copy the JSON text into a private channel (encrypted note, password
   manager, or signed-in cloud notes — never a public chat).
3. On the new device, open the same setup → **מתקדם** → paste into the
   textarea → **ייבוא JSON**.
4. Verify chips appear under each enabled person in the grid.

A placeholder example is committed at
`docs/examples/abuwhatsapp-contacts.import.example.json`. It contains only
fake `+972XXXXXXXXX`-style values.

## Verifying no phone numbers are in source

Run the privacy grep manually:

```sh
git grep -nE '\+?\b(972|1|44|33|49|34|39|55|81)[0-9]{7,12}\b' \
    -- src docs tests memory knowledge \
  || echo "PASS — no committed real phone-like values"
```

The committed test `phonePrivacy.test.ts` performs the same scan as part of
`npm test` and fails if any committed file contains an obvious E.164 number.
Safe placeholders (`+972XXXXXXXXX`, `+972...`) and pinned synthetic test
fixtures (`+972501234567`) are explicitly allow-listed in the test.

## Ari and Anabel — visible-by-default

Ari and Anabel ship in the public scaffold with photos and empty phones. They
appear in the grid at all times, but no action chips render until the operator
saves a real phone number for them via the setup screen.

Tapping their bubble without a phone shows a gentle, family-friendly two-line
message (they are still little and don't have their own phone yet) — not the
generic "המספר עדיין לא הוגדר" line that every other contact gets. The
behaviour is centralised in `getMissingPhoneMessage(contactId)` in
`familyQuickFaces.tsx`, which returns the cute copy only for ids `ari` and
`anabel`. Once an operator saves a phone for either of them, the helper is
no longer consulted: the bubble becomes actionable like any other contact.

This matches the product rule: **family members appear on screen first;
configuration follows.**

## Family group behaviour

The family group is rendered as one tile in the same grid, same size, same
label style. Its target is the WhatsApp group invite URL (committed in
`familyContacts.private.ts`). The group tile NEVER renders chips — there is no
"call a group" semantics. Tapping the group bubble opens the WhatsApp invite
URL directly.

## Action URLs (`tel:` and `wa.me`)

For every actionable person tile (operator saved a valid phone + `enabled`):

- **WhatsApp chip** → `https://wa.me/<digits>` where `<digits>` is the
  E.164 number stripped of `+`, dashes, and spaces. WhatsApp accepts only
  digits in `wa.me` URLs.
- **Call chip** → `tel:+<digits>` — RFC 3966 expects the leading `+` for an
  E.164 dial string.

Both URLs are produced by `buildWhatsAppPersonUrl()` and `buildTelUrl()` in
`familyQuickFaces.tsx`. URLs never include surrounding whitespace, dashes, or
parentheses.

## QA checklist

### iPhone (Safari, iOS 17+)

- [ ] Open the public preview URL.
- [ ] Activate operator mode (`?operator=1` or long-press title).
- [ ] Save one valid `+972…` phone number for one contact, mark it פעיל.
- [ ] Close setup. The contact's bubble shows וואטסאפ + שיחה chips.
- [ ] Tap the שיחה chip → iOS prompts "Call <number>?" → confirm → dialer opens.
- [ ] Tap the וואטסאפ chip → WhatsApp app opens (or App Store if not installed).
- [ ] Refresh the page; chips persist (localStorage is preserved).
- [ ] Open Safari Private Browsing; no chips render anywhere.
- [ ] Long-press the title for 1.5s; setup opens.

### Android / Galaxy (Chrome)

- [ ] Repeat the operator save flow.
- [ ] Tap שיחה → Android prompts to choose dialer.
- [ ] Tap וואטסאפ → WhatsApp opens, or browser opens `wa.me/<digits>`.
- [ ] Verify Hebrew RTL: chips, name, and toast are right-aligned.
- [ ] Verify each chip is at least 44 px tall and 44 px wide enough for an
      adult finger.
- [ ] Open Chrome Incognito; no contacts persist (expected).

## Hard rules summary

- No real phone numbers in source, docs, tests, memory, knowledge,
  build constants, or screenshots/reports.
- localStorage key never changes: `abubank.familyContacts.v1`.
- Photos under `public/family-contacts/` are never edited; their committed
  filename case (e.g. `ARI.JPEG`, `Anabel.JPEG`) is preserved.
- Family group is WhatsApp-only; no `tel:` action.
