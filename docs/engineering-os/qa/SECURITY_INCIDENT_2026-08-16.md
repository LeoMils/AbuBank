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

**Exposure window (Vercel CLI, read-only, 20 visible Preview deployments — no separate Production env;
the canonical alias points to a Preview build):**
- `VITE_OPENAI_API_KEY` — **PRESENT in the oldest-visible (`7gn4kv4ue`) AND the newest (`aidjt61nt`, ~3h
  ago) deployments** → confirmed exposed across the FULL visible ~9h window and **still live as of the
  newest deploy**. The true first-exposed deployment predates the 20 visible entries and cannot be
  proven without deeper history — do not invent a start date.
- `VITE_AZURE_TTS_KEY` — confirmed in the tested RC (`f3dpms`), **absent** in the oldest-visible and
  newest scanned → **intermittent / build-env-dependent**, not present in every build.
- `VITE_GEMINI_API_KEY` — confirmed in `f3dpms` + canonical alias.
- The `serverCredentialContract` rename fix is committed but **NOT yet deployed**, so exposure is ongoing
  until the owner removes the VITE_ build-env vars and redeploys.

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
- **Source maps: NOT shipped — earlier "200" was OVER-CLAIMED and is RETRACTED.** `GET *.js.map`
  returns 200 but the BODY is `<!DOCTYPE html>` — the Vercel SPA-rewrite fallback (index.html), NOT a
  source map (no `version`/`sources`/`mappings`). A local build (`sourcemap` default false) produces no
  `.map`. Verified by content, not status — the exact rigor this incident demands. No finding.
- **PII phones: clean** — 0 Israeli mobile numbers in the bundle (privacy rule holds; not a finding).
- **WhatsApp family group invite** (`chat.whatsapp.com/…`) is in the bundle — `SUSPICIOUS_NEEDS_CLASSIFICATION`:
  likely intentional (the app's purpose is family connection), but anyone with the bundle can join the
  family group. Owner **product decision**, not a confirmed leak.
- **Lesson for the shipped-artifact gate:** a URL 200 under an SPA rewrite is NOT proof an asset exists;
  the gate must classify by BODY content (a `.map` must parse as a source map), never by status code.
- **Other billable search-provider keys** (`VITE_BRAVE/EXA/TAVILY/PERPLEXITY/OPENROUTER_API_KEY`):
  **all ABSENT** from the bundle — not leaked (contract covers them; specificity preserved).
- **Service-worker precache: clean** — `sw.js` (~2.7KB workbox) precaches static assets only; no
  `/api/`, secret, token, or key references.
- **Security headers: only HSTS is set** — no CSP, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy, or Permissions-Policy. LOW–MEDIUM hardening gap (same "output never gated" class);
  a defense-in-depth CSP would also blunt exfiltration of an inlined key. Evidence: `curl -I`.
