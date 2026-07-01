# AbuAI — Final Release Decision

Version **0.9.3-gauntlet-reports** · branch `rc5/cognitive-architecture-and-acceptance`
(NOT merged to main) · HEAD `d41d923`. Gates re-verified this decision [RUN].

## Final code-side verdict
**CODE-SIDE PRODUCTION READY.** Every code-testable capability is GREEN. No
code-testable RED or YELLOW remains. Only NON-CODE blockers stand between here and
full production.

## Gates (executed this decision) [RUN]
| Gate | Result |
|---|---|
| `npm run validate:family` | ALL PASSED |
| `npm run validate:knowledge` | ALL PASSED |
| `npm run typecheck` | clean |
| `npm run test` | 198 files / **5984 passed / 0 failed** |
| `npm run build` | exit 0 |
| deploy health | root 200 · chat 200 · online 200 · `OPENAI_API_KEY` present · `realtime-token`=**REALTIME_PROVIDER_FAILED** |
| eval/judge (last run) | NORTH_STAR **100%** (2530) · JUDGE **100/100** (115) |

## What is GREEN (code-proven)
Core deterministic conversation · Hebrew · Spanish · mixed he/es · calendar
(create/read/update/confirm/cancel) · reminders · memory (persistence + retrieval) ·
family graph · knowledge update/validation · emotional tone · adult non-patronizing
style · continuity · online routing · general-knowledge routing · error recovery /
localized fallback · voice **text** path · safety/privacy (no PII/banned leak, no
secrets) · mobile/PWA build · build/tests · deployment · eval/judge/replay.

## What is NON-CODE (must NOT be marked green here)
1. **Physical iPhone microphone/audio** — ⚪ unproven in code — owner **Leo**.
2. **Realtime provider** — ⚪ `REALTIME_PROVIDER_FAILED` — owner **account** (pipeline fallback ships).
3. **Live LLM answer prose depth** — 🟡 — needs a separate live-model judge; deterministic layer is green.
4. **Human acceptance** — ⚪ — Leo/Martita felt experience.

## Leo iPhone test checklist (physical — NON-CODE)
Open newest deploy on iPhone Safari → Add to Home Screen → tap voice → allow mic.
- [ ] Mic captures Hebrew AND Spanish reliably (STT accurate).
- [ ] TTS plays aloud after EVERY answer (0 text-only).
- [ ] Voice sounds warm/natural — not robotic/slow/drunk.
- [ ] Local answer starts speaking < 3 s after transcript; online < 7 s or honest fallback.
- [ ] Realtime being down → app falls back silently to pipeline (no error card).
- [ ] Run the 30-line script in `docs/abuai/FINAL_HUMAN_ACCEPTANCE_TEST.md`; 0 red rows; avg ≥ 4.0.

## Realtime provider action (account)
- [ ] Confirm `curl -X POST <deploy>/api/realtime-token` → currently `REALTIME_PROVIDER_FAILED`.
- [ ] In Vercel env, restore/valid OpenAI Realtime entitlement + key/quota.
- [ ] Redeploy; re-curl → expect an `ephemeral` token (only THEN is Realtime green).
- [ ] Not a launch blocker — pipeline fallback is validated.

## Human acceptance checklist (Leo / Martita)
- [ ] Warm, adult, non-patronizing tone (rows 1, 18–20, 27–28).
- [ ] Correct family facts (rows 12–14).
- [ ] Calendar create/confirm/location/3:00-not-03:00 (rows 2–10).
- [ ] Memory continue + honest "why" (rows 15–17).
- [ ] No fabricated life, no menu, no childish language.

## Merge-to-main checklist (after Leo PASS)
- [ ] Acceptance test PASS on device (0 red rows).
- [ ] `npm run validate:family && npm run validate:knowledge && npm run check && npm run build` green.
- [ ] No secrets in diff (`git ls-files | grep .env` → only `.env.example`; no `sk-` in src/api).
- [ ] `git checkout main && git merge --no-ff rc5/cognitive-architecture-and-acceptance`
- [ ] `git push origin main`

## Production promotion checklist (Vercel)
- [ ] Main deployment builds; `/api/health` buildVersion == committed version.
- [ ] Promote main deployment to the production domain (Vercel → Promote to Production).
- [ ] Verify env: `OPENAI_API_KEY` present (+ Realtime key if restored).
- [ ] Post-promote smoke: `curl <prod>/api/health` 200; chat 200; online 200; PWA opens on iPhone.

## Rollback plan
- Vercel deploys are immutable → rollback = re-promote the previous healthy deployment
  (last good `0.9.2-gauntlet-eval-depth`).
- Git: `git revert <sha>`; never force-push main.
- Data: `memory/*` + `knowledge/family/people/*` regenerate (`generate:memory` / `generate:knowledge`) — no data-loss risk.

## GO / HOLD decision rules
- **GO** (merge + promote) ONLY if: all gates green AND device acceptance PASS (0 red rows) AND no secret in diff.
- **HOLD** if: any gate fails, any red acceptance row, voice unusable on device, or a secret appears.
- Realtime down is **NOT** a HOLD (fallback ships) — note as a known limitation.
- Live LLM prose depth is **NOT** a code HOLD — flag for the live judge; deterministic layer is green.
- Do NOT claim FULL production until Leo completes the physical test.

## Bottom line
Code side: **DONE / READY**. Next gate is human + device. After Leo's acceptance test
passes, follow merge → promote above. Until then: **HOLD promotion; code is GO.**
