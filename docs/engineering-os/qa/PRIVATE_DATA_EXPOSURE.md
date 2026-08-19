# Private family data in the public bundle — release-blocking residual

**Status:** OPEN (materially larger migration than the auth closure; reported here, not
closed in the 0.293.0-auth security pass). This is the remaining reason
`NO_LOGIN_PWA_AUTH_POLICY` is not declared fully CLOSED — unless the owner explicitly
approves the exposure below as product policy.

## What is exposed
`knowledge/family_data.json` (~30 KB) is imported **synchronously** by runtime modules and
is therefore compiled into the **public client JS bundle**. Anyone who loads the app URL can
download and read it — the client entry lock does not (and cannot) protect it, because the
bundle is already on the wire before any gate renders.

Contents (≈70 real people):

| Class | Fields | Classification |
|---|---|---|
| Identities & relationships | `canonical_name`, `hebrew_name`, `aliases`, `relationship(_hebrew)`, `spouse`/`partner`/`ex_spouse`, `father`/`children` links | **PRIVATE** |
| Dates | `birthday`, `birth_year`, deceased `date_of_passing` / `memorial_date` | **PRIVATE** (birthdays of living people) / **SENSITIVE** (memorial) |
| Coarse location | `location` = **city only** (Kfar Saba); `origin` | PRIVATE (low sensitivity) |
| Other | `occupation`, free-text `notes`, `pronunciation`, `gender`, `pets` | PRIVATE; `notes` **potentially SENSITIVE** |

Already **excluded** by design (`pii_excluded` in the file): exact street address / floor /
apartment / parking, gate-opening method, Martita's phone number, ID number, and specific
health details. So the hardest PII is NOT present; what remains is identifiable
names/relationships/birthdays of living family + friends.

## Risk
- **Privacy**: a stranger with the URL can enumerate Martita's family graph (names, who is
  married to whom, birthdays, city, occupations, free-text notes). Identifiable personal data
  about living individuals, published without access control.
- **Not a billing/keys risk** — that is fully closed by 0.293.0 server auth. This residual is
  purely a *data-confidentiality* exposure.

## Why it was not closed in this pass (materially larger)
The data is consumed by **many** runtime modules, several importing the JSON **directly**
(not via a single loader): `familyLoader.ts`, `screens/AbuAI/{familyGraph,familyReasoning,
service,tools,router,responseShaper,whatsappCompose}`, `screens/AbuCalendar/{familyEvents,
familyResolve,service}`, `screens/AbuWhatsApp/{service,familyQuickFaces}`,
`services/{liveContacts,liveInstructions,people/peopleModel,qa/scopeInventory}`. Family
reasoning, calendar family events, contacts and live-voice instructions all read it
**synchronously and offline**. Converting that to an authenticated async fetch is a broad,
regression-prone change (family reasoning + calendar + contacts + the 13k-test corpus that
encodes family behavior), and would need offline caching (PWA) after first authed fetch. That
is a distinct, larger workstream than the billable-endpoint auth this pass delivered.

## Migration plan (minimum safe)
1. **Serve `/api/family`** behind the same server session (`guardBillable` / `requireSession`)
   — returns `family_data.json` only to an authenticated device. 401 otherwise.
2. **Stop bundling the JSON**: replace the static `import familyRaw from '…/family_data.json'`
   sites with a single `familyLoader` that hydrates from `/api/family` at boot (after the
   passkey session is obtained) into a module cache the existing **synchronous** `loadFamilyData()`
   API reads — so downstream modules stay unchanged. Persist the fetched copy in IndexedDB for
   offline/PWA use (encrypted-at-rest optional; device is already locked).
3. **Tests**: the 13k-test corpus imports the JSON directly for fixtures — keep a *test-only*
   fixture import (dev/test), gate the *bundle* import out of production via the loader. Add a
   bundle-scan test asserting no family name string appears in `dist/**` client assets.
4. **Evidence**: redeploy → `curl /api/family` unauthenticated → 401; grep the built bundle for
   a known family name → absent; family reasoning / calendar / whatsapp acceptance still pass.

Estimated blast radius: ~15 runtime modules + the loader + a new endpoint + offline cache +
new bundle-scan test. Should be its own scoped pass with a fresh RC + Monster recert.

## The fast alternative (owner decision)
If the owner judges that **names + relationships + birthdays + city** (PII already stripped)
are acceptable to ship in the client for this private, install-only family app, record that as
explicit **product policy** and `NO_LOGIN_PWA_AUTH_POLICY` can be marked CLOSED on the strength
of the server-auth billing/data-API protection alone. Do not mark it CLOSED by default while
this data is intentionally public without that approval.
