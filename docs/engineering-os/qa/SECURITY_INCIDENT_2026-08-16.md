# SECURITY INCIDENT — credentials exposed in shipped client bundle (2026-08-16)

**RELEASE_STATE: BLOCKED_P0_SECURITY.** No secret value appears in this report — only
non-reversible FNV correlation fingerprints. All shipped copies must be treated as permanently
public; **rotation/revocation**, not deletion, is what makes the leaked credentials unusable.

## Confirmed exposed credentials (read-only bundle scan; see `deployed-secret-exposure.json`)
Same three fingerprints appear in BOTH deployments → both ship the identical keys.

| Key | Kind | Fingerprint | Len | Class |
|---|---|---|---|---|
| `VITE_AZURE_TTS_KEY` | billable server-only | `fp:3009af2e` | 84 | **CONFIRMED_SECRET_EXPOSED** |
| `VITE_OPENAI_API_KEY` | billable server-only | `fp:e39ef3b7` | 164 | **CONFIRMED_SECRET_EXPOSED** |
| `VITE_GEMINI_API_KEY` | free-tier credential | `fp:69150fc4` | 39 | **CONFIRMED_SECRET_EXPOSED** |

## NOT exposed / not over-claimed
- `VITE_GROQ_API_KEY` — **NOT_PRESENT_IN_SHIPPED_BUNDLE** (do not call it leaked).
- `VITE_AZURE_TTS_REGION`, `VITE_APP_VERSION`, `VITE_COMMIT_SHA` — **PUBLIC_CLIENT_CONFIGURATION**
  (legitimately public; presence is not a leak).

## Affected deployments
| Deployment | Build | Commit fp | Status |
|---|---|---|---|
| RC `abu-bank-f3dpms0ta…vercel.app` | 0.286.0-earonly | `fp:234566f5` | exposes all 3 |
| canonical `abu-ela-rc.vercel.app` | 0.286.0-earonly | `fp:500…`/differs | exposes all 3 |

**Exposure window:** earliest-confirmed = the two 0.286.0-earonly builds scanned 2026-08-16;
first-exposed deployment **cannot be proven without Vercel deployment history (owner)** — do not invent a start date.

## Root cause
Billable/server-only keys given a `VITE_` prefix and set in the Vercel build env. Vite exposes ALL
`VITE_`-prefixed vars to the client, so any `import.meta.env.VITE_*` access inlines the full env
object (incl. these keys) into the bundle. `ENV_CONTRACT.md` line 27 already warns against exactly this.

## Why prior QA missed it (failure genome F21 — class `input-checked-output-unverified`)
- `check-client-secret-leak.cjs` scans the build ENV + loose `sk-` tokens.
- `clientProviderKeyContract.test.ts` checks client SOURCE never READS a billable key.
- **Neither inspected the actual shipped BUNDLE** for a credential name+value. New gate:
  `bundleSecretScan.ts` (`classifyShippedKeys`), certified in `bundleSecretScan.test.ts`.

## Owner action required (mandatory STOP — secrets/env; not in agent scope)
1. **Rotate/revoke** all three exposed credentials now (Azure TTS, OpenAI, Gemini).
2. Remove `VITE_AZURE_TTS_KEY` / `VITE_OPENAI_API_KEY` (and any billable `VITE_*`) from the Vercel
   build env; use non-`VITE_` server-only vars (`AZURE_TTS_KEY`, `OPENAI_API_KEY`).
3. Redeploy; agent re-runs `scan-deployed-secrets` to verify old fingerprints absent + no new secret shipped.

## Post-rotation verification claim (do NOT claim "removed from the Internet")
- `COMPROMISED_CREDENTIAL_REVOKED` (owner) + `NEW_DEPLOYMENT_DOES_NOT_EXPOSE_REPLACEMENT` (agent, scan).

## §8 sibling "input-checked / output-unverified" findings (evidence-backed)
- **Source maps are publicly shipped** — `GET /assets/index-*.js.map` → **200**. MEDIUM: full source
  disclosure, and it makes extracting the exposed keys trivial. Same class as F21 (build config
  assumed, shipped artifact not verified). Fix: do not ship `.map` to public deployments (or restrict).
- **PII phones: clean** — 0 Israeli mobile numbers in the bundle (privacy rule holds; not a finding).
- **WhatsApp family group invite** (`chat.whatsapp.com/…`) is in the bundle — `SUSPICIOUS_NEEDS_CLASSIFICATION`:
  likely intentional (the app's purpose is family connection), but anyone with the bundle can join the
  family group. Owner **product decision**, not a confirmed leak.
